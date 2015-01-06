require("prototype");

require("./cop");

var Bluebird = require("bluebird");

function construct(constructor, args) {
    function F() {
        return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
}

function copPromise(originalPromise) {
	this._layers = cop.LayerStack.clone();

	if (originalPromise instanceof Bluebird) {
		this._original = originalPromise;
	} else {
		var args = this._correctFunctionArgs(arguments);
		this._original = construct(Bluebird, arguments);
	}
}

copPromise.prototype._correctFunctionArgs = function (args) {
	return Array.prototype.slice.call(args).map(function (argument) {
		if (typeof argument === "function") {
			return this._restoreContextCall(argument);
		}

		return argument;
	}, this);
};

copPromise.prototype._restoreContextCall = function(func) {
	var that = this;
	return function () {
		var oldLayerStack = cop.LayerStack.clone();
		cop.LayerStack = that._layers;

		var result = func.apply(that, arguments);

		cop.LayerStack = oldLayerStack;

		return result;
	};
};

copPromise.prototype.withLayers = function (layers) {
	this._layers.push({withLayers: layers});
};

copPromise.prototype.withoutLayers = function (layers) {
	this._layers.push({withoutLayers: layers});
};

function prototypeOverRide(ownClass, functionName) {
	ownClass.prototype[functionName] = function () {
		var oldLayerStack = cop.LayerStack.clone();
		cop.LayerStack = this._layers;

		var resultArgs = this._correctFunctionArgs(arguments);
		var result = this._original[functionName].apply(this._original, resultArgs);

		if (result instanceof Bluebird) {
			result = new copPromise(result);
		}

		cop.LayerStack = oldLayerStack;
		return result;
	};
}

function overRide(ownClass, functionName) {
	ownClass[functionName] = function () {
		var result = Bluebird[functionName].apply(Bluebird, arguments);

		if (result instanceof Bluebird) {
			result = new copPromise(result);
		}

		return result;
	};	
}

var prototypeOverRides = ["then", "catch", "error", "finally", "bind", "isFulfilled", "isRejected", "isPending", "value", "reason", "reflect", "delay", "timeout"];

prototypeOverRides.forEach(function (name) {
	prototypeOverRide(copPromise, name);
});

overRides = ["resolve", "reject", "delay"];

overRides.forEach(function (name) {
	overRide(copPromise, name);
});

cop.create('AddressLayer');
cop.create('EmploymentLayer');

Object.subclass('Person', {
	initialize: function(newName, newAddress, newEmployer) {
		this.name = newName;
		this.address = newAddress;
		this.employer = newEmployer;
	},
	print: function() {
		return "Name: " + this.name;
	},
	AddressLayer$print: function() {
		return cop.proceed() + "; Address: " + this.address;
	},
	EmploymentLayer$print: function() {
		return cop.proceed() + "; [Employer] " +
			this.employer.print();
	},
	toString: function() {
		return "Person: " + this.name;
	}
});

Object.subclass('Employer', {
	initialize: function(newName, newAddress) {
		this.name = newName;
		this.address = newAddress;
	},
	print: function() {
		return "Name: " + this.name;
	},
	toString: function() {
		return "Employer: " + this.name;
	}
});

AddressLayer.refineClass(Employer, {
	print: function() {
		return cop.proceed() + "; Address: " + this.address;
	}
});

employer = new Employer("Doener AG", "An der Ecke, 124 Berlin");
person = new Person("Hans Peter", "Am Kiez 49, 123 Berlin", employer);

withLayers([AddressLayer], function () {
	copPromise.delay(500).then(function () {
		console.log(person.print());
	}).then(function () {
		return withLayers([EmploymentLayer], function () {
			return person.print();
		});
	}).then(function (personLong) {
		console.log(personLong);
		console.log(person.print());
	});
});

withLayers([AddressLayer, EmploymentLayer], function () {
	new copPromise(function (resolve, reject) {
		setTimeout(resolve, 500);
	}).then(function () {
		console.log("other:" + person.print());
	});
});
