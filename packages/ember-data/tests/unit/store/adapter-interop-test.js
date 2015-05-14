var get = Ember.get;
var set = Ember.set;
var resolve = Ember.RSVP.resolve;
var TestAdapter, store;
var run = Ember.run;

module("unit/store/adapter_interop - DS.Store working with a DS.Adapter", {
  setup: function() {
    TestAdapter = DS.Adapter.extend();
  },
  teardown: function() {
    run(function() {
      if (store) { store.destroy(); }
    });
  }
});

test("Adapter can be set as a factory", function() {
  store = createStore({ adapter: TestAdapter });

  ok(store.get('defaultAdapter') instanceof TestAdapter);
});

test('Adapter can be set as a name', function() {
  store = createStore({ adapter: '-rest' });

  ok(store.get('defaultAdapter') instanceof DS.RESTAdapter);
});

test('Adapter can not be set as an instance', function() {
  expect(5);

  store = DS.Store.create({
    adapter: DS.Adapter.create()
  });
  var assert = Ember.assert;
  Ember.assert = function() { ok(true, "raises an error when passing in an instance"); };
  store.get('defaultAdapter');
  Ember.assert = assert;
});

test("Calling Store#find invokes its adapter#find", function() {
  expect(5);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      ok(true, "Adapter#find was called");
      equal(store, currentStore, "Adapter#find was called with the right store");
      equal(type, currentType, "Adapter#find was called with the type passed into Store#find");
      equal(id, 1, "Adapter#find was called with the id passed into Store#find");
      equal(snapshot.id, '1', "Adapter#find was called with the record created from Store#find");

      return Ember.RSVP.resolve({ id: 1 });
    }
  });

  var currentStore = createStore({ adapter: adapter });
  var currentType = DS.Model.extend();

  run(function() {
    currentStore.find(currentType, 1);
  });
});

test("Calling Store#findById multiple times coalesces the calls into a adapter#findMany call", function() {
  expect(2);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      ok(false, "Adapter#find was not called");
    },
    findMany: function(store, type, ids, snapshots) {
      start();
      ok(true, "Adapter#findMany was called");
      deepEqual(ids, ["1","2"], 'Correct ids were passed in to findMany');
      return Ember.RSVP.resolve([{ id: 1 }, { id: 2 }]);
    },
    coalesceFindRequests: true
  });

  var currentStore = createStore({ adapter: adapter });
  var currentType = DS.Model.extend();
  currentType.modelName = "test";
  stop();
  run(function() {
    currentStore.find(currentType, 1);
    currentStore.find(currentType, 2);
  });
});

test("Returning a promise from `find` asynchronously loads data", function() {
  expect(1);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      return resolve({ id: 1, name: "Scumbag Dale" });
    }
  });

  var currentStore = createStore({ adapter: adapter });
  var currentType = DS.Model.extend({
    name: DS.attr('string')
  });

  run(function() {
    currentStore.find(currentType, 1).then(async(function(object) {
      strictEqual(get(object, 'name'), "Scumbag Dale", "the data was pushed");
    }));
  });
});

test("IDs provided as numbers are coerced to strings", function() {
  expect(4);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      equal(typeof id, 'string', "id has been normalized to a string");
      return resolve({ id: 1, name: "Scumbag Sylvain" });
    }
  });

  var currentStore = createStore({ adapter: adapter });
  var currentType = DS.Model.extend({
    name: DS.attr('string')
  });

  run(function() {
    currentStore.find(currentType, 1).then(async(function(object) {
      equal(typeof object.get('id'), 'string', "id was coerced to a string");
      run(function() {
        currentStore.push(currentType, { id: 2, name: "Scumbag Sam Saffron" });
      });
      return currentStore.find(currentType, 2);
    })).then(async(function(object) {
      ok(object, "object was found");
      equal(typeof object.get('id'), 'string', "id is a string despite being supplied and searched for as a number");
    }));
  });
});


var array = [{ id: "1", name: "Scumbag Dale" }, { id: "2", name: "Scumbag Katz" }, { id: "3", name: "Scumbag Bryn" }];

test("can load data for the same record if it is not dirty", function() {
  expect(3);

  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  run(function() {
    store.push(Person, { id: 1, name: "Tom Dale" });

    store.find(Person, 1).then(async(function(tom) {
      equal(get(tom, 'isDirty'), false, "precond - record is not dirty");
      equal(get(tom, 'name'), "Tom Dale", "returns the correct name");

      store.push(Person, { id: 1, name: "Captain Underpants" });
      equal(get(tom, 'name'), "Captain Underpants", "updated record with new date");
    }));
  });
});

/*
test("DS.Store loads individual records without explicit IDs with a custom primaryKey", function() {
  var store = DS.Store.create();
  var Person = DS.Model.extend({ name: DS.attr('string'), primaryKey: 'key' });

  store.load(Person, { key: 1, name: "Tom Dale" });

  var tom = store.find(Person, 1);
  equal(get(tom, 'name'), "Tom Dale", "the person was successfully loaded for the given ID");
});
*/

test("pushMany extracts ids from an Array of hashes if no ids are specified", function() {
  expect(1);

  var store = createStore();

  var Person = DS.Model.extend({ name: DS.attr('string') });

  run(function() {
    store.pushMany(Person, array);
    store.find(Person, 1).then(async(function(person) {
      equal(get(person, 'name'), "Scumbag Dale", "correctly extracted id for loaded data");
    }));
  });
});

test("loadMany takes an optional Object and passes it on to the Adapter", function() {
  expect(2);

  var passedQuery = { page: 1 };

  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  var adapter = TestAdapter.extend({
    findQuery: function(store, type, query) {
      equal(type, Person, "The type was Person");
      equal(query, passedQuery, "The query was passed in");
      return Ember.RSVP.resolve([]);
    }
  });

  var store = createStore({
    adapter: adapter
  });

  run(function() {
    store.find(Person, passedQuery);
  });
});

test("Find with query calls the correct extract", function() {
  var passedQuery = { page: 1 };

  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  var adapter = TestAdapter.extend({
    findQuery: function(store, type, query) {
      return Ember.RSVP.resolve([]);
    }
  });

  var callCount = 0;

  var ApplicationSerializer = DS.JSONSerializer.extend({
    extractFindQuery: function(store, type, payload) {
      callCount++;
      return [];
    }
  });

  var env = setupStore({
    adapter: adapter
  });
  var store = env.store;

  env.registry.register('serializer:application', ApplicationSerializer);

  run(function() {
    store.find(Person, passedQuery);
  });
  equal(callCount, 1, 'extractFindQuery was called');
});

test("all(type) returns a record array of all records of a specific type", function() {
  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  run(function() {
    store.push(Person, { id: 1, name: "Tom Dale" });
  });

  var results = store.all(Person);
  equal(get(results, 'length'), 1, "record array should have the original object");
  equal(get(results.objectAt(0), 'name'), "Tom Dale", "record has the correct information");

  run(function() {
    store.push(Person, { id: 2, name: "Yehuda Katz" });
  });
  equal(get(results, 'length'), 2, "record array should have the new object");
  equal(get(results.objectAt(1), 'name'), "Yehuda Katz", "record has the correct information");

  strictEqual(results, store.all(Person), "subsequent calls to all return the same recordArray)");
});

test("a new record of a particular type is created via store.createRecord(type)", function() {
  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });
  var person;

  run(function() {
    person = store.createRecord(Person);
  });

  equal(get(person, 'isLoaded'), true, "A newly created record is loaded");
  equal(get(person, 'isNew'), true, "A newly created record is new");
  equal(get(person, 'isDirty'), true, "A newly created record is dirty");

  run(function() {
    set(person, 'name', "Braaahm Dale");
  });

  equal(get(person, 'name'), "Braaahm Dale", "Even if no hash is supplied, `set` still worked");
});

test("a new record with a specific id can't be created if this id is already used in the store", function() {
  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  Person.reopenClass({
    toString: function() {
      return 'Person';
    }
  });

  run(function() {
    store.createRecord(Person, { id: 5 });
  });

  expectAssertion(function() {
    run(function() {
      store.createRecord(Person, { id: 5 });
    });
  }, /The id 5 has already been used with another record of type Person/);
});

test("an initial data hash can be provided via store.createRecord(type, hash)", function() {
  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });
  var person;

  run(function() {
    person = store.createRecord(Person, { name: "Brohuda Katz" });
  });

  equal(get(person, 'isLoaded'), true, "A newly created record is loaded");
  equal(get(person, 'isNew'), true, "A newly created record is new");
  equal(get(person, 'isDirty'), true, "A newly created record is dirty");

  equal(get(person, 'name'), "Brohuda Katz", "The initial data hash is provided");
});

test("if an id is supplied in the initial data hash, it can be looked up using `store.find`", function() {
  expect(1);

  var store = createStore();
  var Person = DS.Model.extend({
    name: DS.attr('string')
  });
  var person;

  run(function() {
    person = store.createRecord(Person, { id: 1, name: "Brohuda Katz" });
    store.find(Person, 1).then(async(function(again) {
      strictEqual(person, again, "the store returns the loaded object");
    }));
  });
});

test("initial values of attributes can be passed in as the third argument to find", function() {
  expect(1);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      equal(snapshot.attr('name'), 'Test', 'Preloaded attribtue set');
      return Ember.RSVP.resolve({ id: '1', name: 'Test' });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  run(function() {
    store.find(Person, 1, { name: 'Test' });
  });
});

test("initial values of belongsTo can be passed in as the third argument to find as records", function() {
  expect(1);
  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      equal(snapshot.belongsTo('friend').attr('name'), 'Tom', 'Preloaded belongsTo set');
      return new Ember.RSVP.Promise(function() {});
    }
  });

  var env = setupStore({
    adapter: adapter
  });
  var store = env.store;

  var Person = DS.Model.extend({
    name: DS.attr('string'),
    friend: DS.belongsTo('person', { inverse: null })
  });

  env.registry.register('model:person', Person);
  var tom;

  run(function() {
    tom = store.push(Person, { id: 2, name: 'Tom' });
    store.find(Person, 1, { friend: tom });
  });
});

test("initial values of belongsTo can be passed in as the third argument to find as ids", function() {
  expect(1);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      return Ember.RSVP.Promise.resolve({ id: id });
    }
  });

  var env = setupStore({
    adapter: adapter
  });
  var store = env.store;

  var Person = DS.Model.extend({
    name: DS.attr('string'),
    friend: DS.belongsTo('person', { async: true, inverse: null })
  });

  env.registry.register('model:person', Person);

  run(function() {
    store.find(Person, 1, { friend: 2 }).then(async(function() {
      store.getById(Person, 1).get('friend').then(async(function(friend) {
        equal(friend.get('id'), '2', 'Preloaded belongsTo set');
      }));
    }));
  });
});

test("initial values of hasMany can be passed in as the third argument to find as records", function() {
  expect(1);
  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      equal(snapshot.hasMany('friends')[0].attr('name'), 'Tom', 'Preloaded hasMany set');
      return new Ember.RSVP.Promise(function() {});
    }
  });

  var env = setupStore({
    adapter: adapter
  });
  var store = env.store;

  var Person = DS.Model.extend({
    name: DS.attr('string'),
    friends: DS.hasMany('person', { inverse: null })
  });

  env.registry.register('model:person', Person);
  var tom;

  run(function() {
    tom = store.push(Person, { id: 2, name: 'Tom' });
    store.find(Person, 1, { friends: [tom] });
  });
});

test("initial values of hasMany can be passed in as the third argument to find as ids", function() {
  expect(1);

  var adapter = TestAdapter.extend({
    find: function(store, type, id, snapshot) {
      equal(snapshot.hasMany('friends')[0].id, '2', 'Preloaded hasMany set');
      return Ember.RSVP.resolve({ id: id });
    }
  });

  var env = setupStore({
    adapter: adapter
  });
  var store = env.store;

  var Person = DS.Model.extend({
    name: DS.attr('string'),
    friends: DS.hasMany('person', { async: true, inverse: null })
  });

  env.registry.register('model:person', Person);

  run(function() {
    store.find(Person, 1, { friends: [2] });
  });
});

test("records should have their ids updated when the adapter returns the id data", function() {
  expect(2);

  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  var idCounter = 1;
  var adapter = TestAdapter.extend({
    createRecord: function(store, type, snapshot) {
      return Ember.RSVP.resolve({ name: snapshot.attr('name'), id: idCounter++ });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  var people = store.all(Person);
  var tom, yehuda;

  run(function() {
    tom = store.createRecord(Person, { name: 'Tom Dale' });
    yehuda = store.createRecord(Person, { name: 'Yehuda Katz' });
  });

  run(function() {
    Ember.RSVP.all([tom.save(), yehuda.save()]).then(async(function() {
      people.forEach(function(person, index) {
        equal(person.get('id'), index + 1, "The record's id should be correct.");
      });
    }));
  });
});

test("store.fetchMany should always return a promise", function() {
  expect(3);

  var Person = DS.Model.extend();
  var store = createStore({
    adapter: TestAdapter.extend()
  });
  run(function() {
    store.createRecord(Person);
  });
  var records = Ember.A([]);
  var results;

  run(function() {
    results = store.scheduleFetchMany(records);
  });
  ok(results, "A call to store.scheduleFetchMany() should return a result");
  ok(results.then, "A call to store.scheduleFetchMany() should return a promise");

  results.then(async(function(returnedRecords) {
    deepEqual(returnedRecords, [], "The correct records are returned");
  }));
});

test("store.scheduleFetchMany should not resolve until all the records are resolved", function() {
  expect(1);

  var Person = DS.Model.extend();
  var Phone = DS.Model.extend();

  var adapter = TestAdapter.extend({
    find: function (store, type, id, snapshot) {
      var wait = 5;

      var record = { id: id };

      return new Ember.RSVP.Promise(function(resolve, reject) {
        run.later(function() {
          resolve(record);
        }, wait);
      });
    },

    findMany: function(store, type, ids, snapshots) {
      var wait = 15;

      var records = ids.map(function(id) {
        return { id: id };
      });

      return new Ember.RSVP.Promise(function(resolve, reject) {
        run.later(function() {
          resolve(records);
        }, wait);
      });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  run(function() {
    store.createRecord(Person);
  });

  var records = Ember.A([
    store.recordForId(Person, 10),
    store.recordForId(Phone, 20),
    store.recordForId(Phone, 21)
  ]);

  run(function() {
    store.scheduleFetchMany(records).then(async(function() {
      var unloadedRecords = records.filterBy('isEmpty');
      equal(get(unloadedRecords, 'length'), 0, 'All unloaded records should be loaded');
    }));
  });
});

test("the store calls adapter.findMany according to groupings returned by adapter.groupRecordsForFindMany", function() {
  expect(3);

  var Person = DS.Model.extend();

  var adapter = TestAdapter.extend({
    groupRecordsForFindMany: function(store, snapshots) {
      return [
        [snapshots[0]],
        [snapshots[1], snapshots[2]]
      ];
    },

    find: function(store, type, id, snapshot) {
      equal(id, "10", "The first group is passed to find");
      return Ember.RSVP.resolve({ id: id });
    },

    findMany: function(store, type, ids, snapshots) {
      var records = ids.map(function(id) {
        return { id: id };
      });

      deepEqual(ids, ["20", "21"], "The second group is passed to findMany");

      return new Ember.RSVP.Promise(function(resolve, reject) {
        resolve(records);
      });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  var records = Ember.A([
    store.recordForId(Person, 10),
    store.recordForId(Person, 20),
    store.recordForId(Person, 21)
  ]);

  run(function() {
    store.scheduleFetchMany(records).then(async(function() {
      var ids = records.mapBy('id');
      deepEqual(ids, ["10", "20", "21"], "The promise fulfills with the records");
    }));
  });
});

test("the promise returned by `scheduleFetch`, when it resolves, does not depend on the promises returned to other calls to `scheduleFetch` that are in the same run loop, but different groups", function() {
  expect(2);

  var Person = DS.Model.extend();
  var davidResolved = false;

  var adapter = TestAdapter.extend({
    groupRecordsForFindMany: function (store, snapshots) {
      return [
        [snapshots[0]],
        [snapshots[1]]
      ];
    },

    find: function(store, type, id, snapshot) {
      var record = { id: id };

      return new Ember.RSVP.Promise(function(resolve, reject) {
        if (id === 'igor') {
          resolve(record);
        } else {
          run.later(function () {
            davidResolved = true;
            resolve(record);
          }, 5);
        }
      });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  run(function () {
    var davidPromise = store.find(Person, 'david');
    var igorPromise = store.find(Person, 'igor');

    igorPromise.then(async(function () {
      equal(davidResolved, false, "Igor did not need to wait for David");
    }));

    davidPromise.then(async(function () {
      equal(davidResolved, true, "David resolved");
    }));
  });
});

test("the promise returned by `scheduleFetch`, when it rejects, does not depend on the promises returned to other calls to `scheduleFetch` that are in the same run loop, but different groups", function() {
  expect(2);

  var Person = DS.Model.extend();
  var davidResolved = false;

  var adapter = TestAdapter.extend({
    groupRecordsForFindMany: function(store, snapshots) {
      return [
        [snapshots[0]],
        [snapshots[1]]
      ];
    },

    find: function(store, type, id, snapshot) {
      var record = { id: id };

      return new Ember.RSVP.Promise(function(resolve, reject) {
        if (id === 'igor') {
          reject(record);
        } else {
          run.later(function () {
            davidResolved = true;
            resolve(record);
          }, 5);
        }
      });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  run(function () {
    var davidPromise = store.find(Person, 'david');
    var igorPromise = store.find(Person, 'igor');

    igorPromise.then(null, async(function () {
      equal(davidResolved, false, "Igor did not need to wait for David");
    }));

    davidPromise.then(async(function () {
      equal(davidResolved, true, "David resolved");
    }));
  });
});

test("store.fetchRecord reject records that were not found, even when those requests were coalesced with records that were found", function() {
  expect(4);

  var Person = DS.Model.extend();

  var adapter = TestAdapter.extend({
    findMany: function(store, type, ids, snapshots) {
      var records = ids.map(function(id) {
        return { id: id };
      });

      return new Ember.RSVP.Promise(function(resolve, reject) {
        resolve([
          records[0]
        ]);
      });
    }
  });

  var store = createStore({
    adapter: adapter
  });

  warns(function() {
    run(function () {
      var davidPromise = store.find(Person, 'david');
      var igorPromise = store.find(Person, 'igor');

      davidPromise.then(async(function () {
        ok(true, "David resolved");
      }));

      igorPromise.then(null, async(function () {
        ok(true, "Igor rejected");
      }));
    });
  }, /expected to find records with the following ids in the adapter response but they were missing/);
});
