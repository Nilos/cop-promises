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
		var oldLayerStack = cop.LayerStack.clone(), error, result;
		cop.LayerStack = that._layers;

		try {
			result = func.apply(that, arguments);
		} catch (e) {
			error = e;
		} finally {
			cop.LayerStack = oldLayerStack;
		}

		if (error) {
			throw error;
		}

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

overRides = ["resolve", "reject", "delay", "all"];

overRides.forEach(function (name) {
	overRide(copPromise, name);
});

copPromise.promisify = function () {
	var result = Bluebird.promisify.apply(Bluebird, arguments);

	return function () {
		var p = result.apply(this, arguments);

		if (p instanceof Bluebird) {
			p = new copPromise(p);
		}

		return p;
	};
};

module.exports = copPromise;
