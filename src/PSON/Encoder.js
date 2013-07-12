/**
 * Constructs a new PSON Encoder.
 * @param {Array.<string>=} values Initial dictionary values
 * @constructor
 */
var Encoder = function(values) {
    values = (values && Array.isArray(values)) ? values : [];
    
    /**
     * Dictionary hash.
     * @type {Object.<string,number>}
     */
    this.dict = {};

    /**
     * Next dictionary index.
     * @type {number}
     */
    this.next = 0;
    while (this.next < values.length) {
        this.dict[values[this.next]] = this.next++;
    }

    /**
     * Dictionary processing stack.
     * @type {Array.<string>}
     */
    this.stack = [];

    /**
     * Whether the whole dictionary has been frozen.
     * @type {boolean}
     */
    this.frozen = false;
};

/**
 * Freezes the encoding dictionary, preventing any keys to be added to it.
 */
Encoder.prototype.freeze = function() {
    this.frozen = true;
};

/**
 * Unfreezes the encoding dictionary, allowing keys to be added to it again.
 */
Encoder.prototype.unfreeze = function() {
    this.frozen = false;
};

/**
 * Encodes JSON to PSON.
 * @param {*} data JSON
 * @returns {ByteBuffer} PSON
 */
Encoder.prototype.encode = function(data) {
    var value = this._encodeValue(data, this.frozen);
    var msg = new PSON.Message();
    while (this.stack.length > 0) {
        msg.dict.push(new PSON.Value( {"str": this.stack.shift()} ));
    }
    msg.data = value;
    return msg.encode();
};

/**
 * Encodes a single JSON value to PSON. If the data cannot be encoded, a NULL-value is returned.
 * @param {*} data JSON
 * @param {boolean=} frozen Whether a parent object is already frozen
 * @returns {PSON.Value} PSON value
 * @private
 */
Encoder.prototype._encodeValue = function(data, frozen) {
    var value = new PSON.Value(), i;
    if (data !== null) {
        switch (typeof data) {
            case 'undefined':
                value.udf = true;
                break;
            case 'string':
                if (this.dict.hasOwnProperty(data)) {
                    value.ref = this.dict[data];
                } else {
                    value.str = data;
                }
                break;
            case 'number':
                var maybeInt = parseInt(data, 10);
                if (data === maybeInt) {
                    value.itg = maybeInt;
                } else {
                    value.dbl = data;
                }
                // TODO: float if possible without precision loss
                break;
            case 'object':
                frozen = frozen || !!data["_PSON_FROZEN_"];
                if (Array.isArray(data)) {
                    value.arr = new PSON.Array();
                    for (i=0; i<data.length; i++) {
                        value.arr.val.push(this._encodeValue(data[i], frozen));
                    }
                } else {
                    value.obj = new PSON.Object();
                    var keys = Object.keys(data), key;
                    for (i=0; i<keys.length; i++) {
                        key = keys[i];
                        if (this.dict.hasOwnProperty(key)) { // Always use the reference if it already exists
                            value.obj.ref.push(this.dict[key]);
                        } else {
                            if (frozen) { // Skip dictionary if frozen
                                value.obj.key.push(key);
                            } else {
                                this.dict[key] = this.next;
                                this.stack.push(key);
                                value.obj.ref.push(this.next++);
                            }
                        }
                        value.obj.val.push(this._encodeValue(data[key], frozen));
                    }
                }
                // TODO: binary data
                break;
            case 'boolean':
                value.bln = data;
                break;
        }
    }
    return value;
};

/** @alias {Encoder} */
PSON.Encoder = Encoder;
