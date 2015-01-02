require("prototype");

require("./cop");

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

console.log(person.print());


withLayers([AddressLayer], function() {
    console.log(person.print());  
});

withLayers([EmploymentLayer], function() {
    console.log(person.print()); 
});

withLayers([EmploymentLayer, AddressLayer], function() { 
    console.log(person.print()); 
});