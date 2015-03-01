var http = require('http');
var redis = require("redis");

var copPromise = require("./main");
var Cookies = require("cookies");

var client = redis.createClient();

var messages = [];

cop.create('LogedinLayer');
cop.create('AdminLayer');

var zadd = copPromise.promisify(client.zadd).bind(client);
var zrem = copPromise.promisify(client.zrem).bind(client);
var zrange = copPromise.promisify(client.zrange).bind(client);

var hgetall = copPromise.promisify(client.hgetall).bind(client);
var hset = copPromise.promisify(client.hset).bind(client);

var incr = copPromise.promisify(client.incr).bind(client);
var get = copPromise.promisify(client.get).bind(client);

Object.subclass('MessageManager', {
	initialize: function () {},
	LogedinLayer$create: function (text) {
		return incr("messages:count").then(function (id) {
			var m = client.multi();

			m.zadd("messages", new Date().getTime(), id);
			m.hmset("messages:" + id, {
				text: text
			});

			var exec = copPromise.promisify(m.exec).bind(m);

			return exec().then(function () {
				return id;
			});
		}).then(function (id) {
			return new Message(id);
		});
	},
	AdminLayer$create: function (text) {
		return cop.proceed(text).then(function (message) {
			return message.makeAdminMessage();
		});
	},
	AdminLayer$deleteAll: function () {
		return get("messages:count").then(function (count) {
			var toDelete = ["messages", "messages:count"];

			for (i = 0; i < count+10; i += 1) {
				toDelete.push("messages:" + i);
			}

			var m = client.multi();
			m.del.apply(m, toDelete);

			var exec = copPromise.promisify(m.exec).bind(m);

			return exec();
		});
	},
	actions: function () {
		return "";
	},
	LogedinLayer$actions: function () {
		return cop.proceed() + "<br><a href='?logout=true'>Logout</a><br><br><form><input type='text' name='content'><input type='hidden' value='message' name='action'><input type='submit'></form>";
	},
	AdminLayer$actions: function () {
		return cop.proceed() + "<br><a href='?action=deleteAll'>Delete all messages</a>";
	},
	getAll: function () {
		return zrange("messages", 0, 100).then(function (messages) {
			return messages.map(function (id) {
				return new Message(id);
			});
		});
	}
});

Object.subclass('Message', {
	initialize: function (id) {
		this.id = id;
	},
	data: function () {
		return hgetall("messages:" + this.id);
	},
	content: function () {
		return this.data().then(function (data) {
			if (data.admin) {
				return "<font color='RED'>" + data.text + "</font>";
			} else {
				return data.text;
			}
		});
	},
	AdminLayer$makeAdminMessage: function () {
		return hset("messages:" + this.id, "admin", 1);
	},
	actions: function () { return ""; },
	LogedinLayer$actions: function () { return cop.proceed() + ""; },
	AdminLayer$actions: function () {
		return cop.proceed() + "<a href='?action=delete&mid=" + this.id + "'>Delete</a>";
	},
	AdminLayer$remove: function () {
		return zrem("messages", this.id);
	},
	toString: function () {
		var that = this;
		return this.content().then(function (content) {
			return content + " - " + that.actions();
		});
	}
});

var myMessageManager = new MessageManager();

function respond(res, response) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end(response);
}

// Create an HTTP server
var srv = http.createServer(function (req, res) {
	var url = require('url');
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;

	var requestPromise = copPromise.resolve();
	var cookies = new Cookies(req, res);

	var user;
	if (!query.logout) {
		user = query.user || cookies.get("user");
	}
	cookies.set("user", user);

	if (user === "admin") {
		requestPromise.withLayers([LogedinLayer, AdminLayer]);
	} else if (user) {
		requestPromise.withLayers([LogedinLayer]);
	}

	requestPromise.then(function () {
		if (query.action === "deleteAll") {
			return myMessageManager.deleteAll().then(function () {
				return "All messages deleted<br><a href='?'>Home</a>";
			});
		} else if (query.action === "message") {
			return myMessageManager.create(query.content).then(function () {
				return "Message created succesfully<br><a href='?'>Home</a>";
			});
		} else if (query.action === "delete") {
			return new Message(query.mid).remove().then(function () {
				return "Message deleted succesfully<br><a href='?'>Home</a>";
			});
		} else {
			return myMessageManager.getAll().then(function (messages) {
				return copPromise.all(messages.map(function (m) { return m.toString(); }));
			}).then(function (messages) {
				return messages.join("<br>") + "<br><br><br>" + myMessageManager.actions();
			});
		}
	}).then(function (answer) {
		respond(res, "<html><body>" + answer + "</body></html>");
	}).catch(function (e) {
		console.error(e.stack);
		respond(res, "<html><body>There was an error!</body></html>");
	});
});

var port = 9000;
srv.listen(port);
console.log("Listening on port " + port);