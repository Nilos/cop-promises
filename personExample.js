var copPromise = require("./main");

cop.create('AddressLayer');
cop.create('EmploymentLayer');

var db = {
	values: {
		personName: "Hans Peter",
		personAddress: "Am Kiez 49, 123 Berlin",
		employerName: "Doener AG",
		employerAddress: "An der Ecke, 124 Berlin"
	},
	get: function (key) {
		return copPromise.delay(db.values[key], 500);
	}
};

Object.subclass('Person', {
	initialize: function(newEmployer) {
		this.employer = newEmployer;
	},
	print: function() {
		return db.get("personName").then(function (name) {
			return "Name: " + name;
		});
	},
	AddressLayer$print: function() {
		return copPromise.all([cop.proceed(), db.get("personAddress")]).then(function (result) {
			var previousValue = result[0];
			var address = result[1];
			return previousValue + "; Address: " + address;
		});
	},
	EmploymentLayer$print: function() {
		return copPromise.all([cop.proceed(), this.employer.print()]).then(function (result) {
			var previousValue = result[0];
			var employer = result[1];

			return previousValue + "; [Employer] " + employer;
		});
	}
});

Object.subclass('Employer', {
	initialize: function() {
	},
	print: function() {
		return db.get("employerName").then(function (name) {
			return "Name: " + name;
		});
	},
});

AddressLayer.refineClass(Employer, {
	print: function() {
		return copPromise.all([cop.proceed(), db.get("employerAddress")]).then(function (result) {
			var previousValue = result[0];
			var address = result[1];

			return previousValue + "; Address: " + address;
		});
	}
});

employer = new Employer();
person = new Person(employer);

console.time("printPerson");
withLayers([AddressLayer], function () {
	person.print().then(function (val) {
		console.timeEnd("printPerson");
		console.log(val);
	});
});

withLayers([AddressLayer, EmploymentLayer], function () {
	person.print().then(function (val) {
		console.log(val);
	});
});
