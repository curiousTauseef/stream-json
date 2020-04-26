'use strict';

const {Transform} = require('stream');

class Emit {
  constructor(tokenName) {
    this.tokenName = tokenName;
  }
}

class Disassembler extends Transform {
  static make(options) {
    return new Disassembler(options);
  }

  constructor(options) {
    super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: true}));
    this._packKeys = this._packStrings = this._packNumbers = this._streamKeys = this._streamStrings = this._streamNumbers = true;
    if (options) {
      'packValues' in options && (this._packKeys = this._packStrings = this._packNumbers = options.packValues);
      'packKeys' in options && (this._packKeys = options.packKeys);
      'packStrings' in options && (this._packStrings = options.packStrings);
      'packNumbers' in options && (this._packNumbers = options.packNumbers);
      'streamValues' in options && (this._streamKeys = this._streamStrings = this._streamNumbers = options.streamValues);
      'streamKeys' in options && (this._streamKeys = options.streamKeys);
      'streamStrings' in options && (this._streamStrings = options.streamStrings);
      'streamNumbers' in options && (this._streamNumbers = options.streamNumbers);
    }
    !this._packKeys && (this._streamKeys = true);
    !this._packStrings && (this._streamStrings = true);
    !this._packNumbers && (this._streamNumbers = true);
  }

  _transform(chunk, encoding, callback) {
    const stack = [chunk],
      isArray = [];
    while (stack.length) {
      const top = stack.pop();
      main: switch (top && typeof top) {
        case 'object':
          if (top instanceof Emit) {
            switch (top.tokenName) {
              case 'keyValue':
                const key = stack.pop();
                if (this._streamKeys) {
                  this.push({name: 'startKey'});
                  this.push({name: 'stringChunk', value: key});
                  this.push({name: 'endKey'});
                }
                this._packKeys && this.push({name: 'keyValue', value: key});
                break main;
              case 'startArray':
                isArray.push(true);
                break;
              case 'startObject':
                isArray.push(false);
                break;
              case 'endArray':
              case 'endObject':
                isArray.pop();
                break;
            }
            this.push({name: top.tokenName});
            break;
          }
          if (Array.isArray(top)) {
            stack.push(new Emit('endArray'));
            for (let i = top.length - 1; i >= 0; --i) {
              stack.push(top[i]);
            }
            stack.push(new Emit('startArray'));
            break;
          }
          // all other objects are just objects
          const keys = Object.keys(top);
          stack.push(new Emit('endObject'));
          for (let i = keys.length - 1; i >= 0; --i) {
            const key = keys[i];
            stack.push(top[key], key, new Emit('keyValue'));
          }
          stack.push(new Emit('startObject'));
          break;
        case 'string':
          if (this._streamStrings) {
            this.push({name: 'startString'});
            this.push({name: 'stringChunk', value: top});
            this.push({name: 'endString'});
          }
          this._packStrings && this.push({name: 'stringValue', value: top});
          break;
        case 'number':
          const number = top.toString();
          if (isNaN(number) || !isFinite(number)) {
            this.push({name: 'nullValue', value: null});
            break;
          }
          if (this._streamNumbers) {
            this.push({name: 'startNumber'});
            this.push({name: 'numberChunk', value: number});
            this.push({name: 'endNumber'});
          }
          this._packNumbers && this.push({name: 'numberValue', value: number});
          break;
        default:
          switch (top) {
            case true:
              this.push({name: 'trueValue', value: true});
              break main;
            case false:
              this.push({name: 'falseValue', value: false});
              break main;
            case null:
              this.push({name: 'nullValue', value: null});
              break main;
          }
          // skip everything else
          break;
      }
    }
    callback(null);
  }
}
Disassembler.disassembler = Disassembler.make;
Disassembler.make.Constructor = Disassembler;

module.exports = Disassembler;
