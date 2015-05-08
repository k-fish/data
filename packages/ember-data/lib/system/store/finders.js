import {
  _bind,
  _guard,
  _objectIsAlive
} from "ember-data/system/store/common";

import {
  normalizeSerializerPayload,
  pushNormalizedSerializerPayload
} from "ember-data/system/store/normalize-serializer-payload";

import {
  serializerForAdapter
} from "ember-data/system/store/serializers";

var get = Ember.get;
var Promise = Ember.RSVP.Promise;

export function _find(adapter, store, typeClass, id, record) {
  var snapshot = record._createSnapshot();
  var promise = adapter.find(store, typeClass, id, snapshot);
  var serializer = serializerForAdapter(store, adapter, typeClass);
  var label = "DS: Handle Adapter#find of " + typeClass + " with id: " + id;

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));

  return promise.then(function(adapterPayload) {
    Ember.assert("You made a request for a " + typeClass.typeClassKey + " with id " + id + ", but the adapter's response did not have any data", adapterPayload);
    return store._adapterRun(function() {
      var payload = serializer.extract(store, typeClass, adapterPayload, id, 'find');

      var normalizedPayload = normalizeSerializerPayload(store, typeClass, payload);
      return pushNormalizedSerializerPayload(store, typeClass, normalizedPayload);
    });
  }, function(error) {
    record.notFound();
    if (get(record, 'isEmpty')) {
      store.unloadRecord(record);
    }

    throw error;
  }, "DS: Extract payload of '" + typeClass + "'");
}


export function _findMany(adapter, store, typeClass, ids, records) {
  var snapshots = Ember.A(records).invoke('_createSnapshot');
  var promise = adapter.findMany(store, typeClass, ids, snapshots);
  var serializer = serializerForAdapter(store, adapter, typeClass);
  var label = "DS: Handle Adapter#findMany of " + typeClass;

  if (promise === undefined) {
    throw new Error('adapter.findMany returned undefined, this was very likely a mistake');
  }

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));

  return promise.then(function(adapterPayload) {
    return store._adapterRun(function() {
      var payload = serializer.extract(store, typeClass, adapterPayload, null, 'findMany');

      Ember.assert("The response from a findMany must be an Array, not " + Ember.inspect(payload),
        Ember.typeOf(payload) === 'array' || (Ember.typeOf(payload) === 'object' && payload.id === undefined && payload.data));

      var normalizedPayload = normalizeSerializerPayload(store, typeClass, payload);
      return pushNormalizedSerializerPayload(store, typeClass, normalizedPayload);
    });
  }, null, "DS: Extract payload of " + typeClass);
}

export function _findHasMany(adapter, store, record, link, relationship) {
  var snapshot = record._createSnapshot();
  var promise = adapter.findHasMany(store, snapshot, link, relationship);
  var serializer = serializerForAdapter(store, adapter, relationship.type);
  var label = "DS: Handle Adapter#findHasMany of " + record + " : " + relationship.type;

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));
  promise = _guard(promise, _bind(_objectIsAlive, record));

  return promise.then(function(adapterPayload) {
    return store._adapterRun(function() {
      var payload = serializer.extract(store, relationship.type, adapterPayload, null, 'findHasMany');

      Ember.assert("The response from a findHasMany must be an Array, not " + Ember.inspect(payload),
        Ember.typeOf(payload) === 'array' || (Ember.typeOf(payload) === 'object' && payload.id === undefined && payload.data));

      var normalizedPayload = normalizeSerializerPayload(store, relationship.type, payload);
      return pushNormalizedSerializerPayload(store, relationship.type, normalizedPayload);
    });
  }, null, "DS: Extract payload of " + record + " : hasMany " + relationship.type);
}

export function _findBelongsTo(adapter, store, record, link, relationship) {
  var snapshot = record._createSnapshot();
  var promise = adapter.findBelongsTo(store, snapshot, link, relationship);
  var serializer = serializerForAdapter(store, adapter, relationship.type);
  var label = "DS: Handle Adapter#findBelongsTo of " + record + " : " + relationship.type;

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));
  promise = _guard(promise, _bind(_objectIsAlive, record));

  return promise.then(function(adapterPayload) {
    return store._adapterRun(function() {
      var payload = serializer.extract(store, relationship.type, adapterPayload, null, 'findBelongsTo');

      if (!payload || (payload && !payload.data)) {
        return null;
      }

      var normalizedPayload = normalizeSerializerPayload(store, relationship.type, payload);
      return pushNormalizedSerializerPayload(store, relationship.type, normalizedPayload);
    });
  }, null, "DS: Extract payload of " + record + " : " + relationship.type);
}

export function _findAll(adapter, store, typeClass, sinceToken) {
  var promise = adapter.findAll(store, typeClass, sinceToken);
  var serializer = serializerForAdapter(store, adapter, typeClass);
  var label = "DS: Handle Adapter#findAll of " + typeClass;

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));

  return promise.then(function(adapterPayload) {
    store._adapterRun(function() {
      var payload = serializer.extract(store, typeClass, adapterPayload, null, 'findAll');

      Ember.assert("The response from a findAll must be an Array, not " + Ember.inspect(payload),
        Ember.typeOf(payload) === 'array' || (Ember.typeOf(payload) === 'object' && payload.id === undefined && payload.data));

      var normalizedPayload = normalizeSerializerPayload(store, typeClass, payload);
      return pushNormalizedSerializerPayload(store, typeClass, normalizedPayload);
    });

    store.didUpdateAll(typeClass);
    return store.all(typeClass);
  }, null, "DS: Extract payload of findAll " + typeClass);
}

export function _findQuery(adapter, store, typeClass, query, recordArray) {
  var promise = adapter.findQuery(store, typeClass, query, recordArray);
  var serializer = serializerForAdapter(store, adapter, typeClass);
  var label = "DS: Handle Adapter#findQuery of " + typeClass;

  promise = Promise.cast(promise, label);
  promise = _guard(promise, _bind(_objectIsAlive, store));

  return promise.then(function(adapterPayload) {
    var records;
    store._adapterRun(function() {
      var payload = serializer.extract(store, typeClass, adapterPayload, null, 'findQuery');

      Ember.assert("The response from a findQuery must be an Array, not " + Ember.inspect(payload),
        Ember.typeOf(payload) === 'array' || (Ember.typeOf(payload) === 'object' && payload.id === undefined && payload.data));

      var normalizedPayload = normalizeSerializerPayload(store, typeClass, payload);
      records = pushNormalizedSerializerPayload(store, typeClass, normalizedPayload);
    });

    recordArray.loadRecords(records);
    return recordArray;

  }, null, "DS: Extract payload of findQuery " + typeClass);
}
