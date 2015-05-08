var forEach = Ember.EnumerableUtils.forEach;
var map = Ember.EnumerableUtils.map;

export function normalizeSerializerPayload(store, typeClass, payload) {
  var normalizedPayload = Ember.create(null);
  var typeKey = typeClass.typeKey || typeClass;

  if (Ember.isArray(payload)) {
    // old format, array
    Ember.deprecate('The format of the payload returned by your serializer has been deprecated. Please make sure your serializer returns the payload in a JSON-API compatible format.');
    normalizedPayload.data = [];
    forEach(payload, function(data) {
      data.type = data.type || typeKey;
      normalizedPayload.data.push(data);
    });
  } else {
    if (payload.hasOwnProperty('data') && !payload.hasOwnProperty('id')) {
      // new format
      normalizedPayload = payload;
    } else {
      // old format, single
      Ember.deprecate('The format of the payload returned by your serializer has been deprecated. Please make sure your serializer returns the payload in a JSON-API compatible format.');
      payload.type = payload.type || typeKey;
      normalizedPayload.data = payload;
    }
  }

  normalizedPayload.meta = normalizedPayload.meta || Ember.create(null);
  normalizedPayload.included = normalizedPayload.included || [];

  if (payload.included) {
    pushManyRecords(store, payload.included);
  }

  return normalizedPayload;
}

export function pushNormalizedSerializerPayload(store, typeClass, payload) {
  var result;

  if (Ember.isArray(payload.data)) {
    result = pushManyRecords(store, payload.data);
    store.setMetadataFor(typeClass, payload.meta);
  } else {
    result = pushSingleRecord(store, payload.data);
  }

  return result;
}

function pushManyRecords(store, data) {
  return map(data, function(data) {
    return pushSingleRecord(store, data);
  });
}

function pushSingleRecord(store, data) {
  return store.push(data.type, data);
}
