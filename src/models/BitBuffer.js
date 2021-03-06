var SHIFT_BYTE = 16;
var CHECKSUM_BYTE = 17;

class BitBuffer {
  constructor(arr) {
    this._arr = arr;
  }

  static newEmptyBuffer() {
    var EMPTY_BLOCKS = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    return new BitBuffer(new Uint8Array(EMPTY_BLOCKS));
  }

  static copy(bufferToCopy) {
    if (!(bufferToCopy instanceof BitBuffer)) {
      throw new Error("BitBuffer's copy constructor only takes BitBuffers as arguments");
    }
    return new BitBuffer(bufferToCopy._arr.slice(0));
  }

  getBit(bit) {
    if (bit === undefined || bit === null) {
      throw new Error('Must provide a bit index to get');
    }

    if ((bit < 0) || (bit > this._arr.length * 8 - 1)) {
      throw new Error('Bit index ' + bit + ' out-of-bounds');
    }

    if (isNaN(bit)) {
      throw new Error('Argument must be a number; got ' + bit);
    }

    var byte = Math.floor(bit / 8);

    return Boolean(this._arr[byte] & (1 << (bit % 8)));
  }

  getBits(bits) {
    if (!bits.length) {
      throw new Error('Must provide bits to set as an array');
    }

    var values = [];

    bits.forEach(function(bit) {
      values.push(this.getBit(bit));
    }.bind(this));

    return values;
  }

  setBit(bit, value) {
    if (bit === undefined || bit === null) {
      throw new Error('Must provide a bit index to set');
    }

    if ((bit < 0) || (bit > this._arr.length * 8 - 1)) {
      throw new Error('Bit index ' + bit + ' out-of-bounds');
    }

    if (isNaN(bit)) {
      throw new Error('Argument must be a number; got ' + bit);
    }


    var byte = Math.floor(bit / 8);

    if (value) {
      this._arr[byte] = this._arr[byte] | (1 << (bit % 8));
    } else {
      this._arr[byte] = this._arr[byte] & ~(1 << (bit % 8));
    }
  }

  setBits(bits, values) {
    if (!bits.length) {
      throw new Error('Must provide bits to set as an array');
    }

    if (!values.length) {
      throw new Error('Must provide bits to set as an array');
    }

    if (bits.length !== values.length) {
      throw new Error('Length of bit indices (' + bits.length + ') and values (' +
                      values.length + ') do not match');
    }

    bits.forEach(function(bit, index) {
      this.setBit(bit, values[index]);
    }.bind(this));
  }

  _validateByteRange(startByte, endByte) {
    if (startByte === null || startByte === undefined || isNaN(startByte)) {
      throw new Error('Start byte must be a number');
    }

    if (endByte === null || endByte === undefined || isNaN(endByte)) {
      throw new Error('End byte must be a number');
    }

    if (startByte < 0 || startByte > this._arr.length - 1) {
      throw new Error('Start byte ' + startByte + ' out-of-bounds');
    }

    if (endByte < 0 || endByte > this._arr.length - 1) {
      throw new Error('End byte ' + endByte + ' out-of-bounds');
    }

    if (startByte > endByte) {
      throw new Error('Start byte must be greater-than or equal to end byte');
    }

  }

  getBytes(startByte, endByte) {
    this._validateByteRange(startByte, endByte);
    return this._arr.slice(startByte, endByte + 1);
  }

  setBytes(startByte, endByte, byteContents) {
    this._validateByteRange(startByte, endByte);

    if (!byteContents) {
      throw new Error('Must provide values to set');
    }

    if (!byteContents.length) {
      throw new Error('Must provide values to set as an array');
    }

    if (byteContents.length !== endByte - startByte + 1) {
      throw new Error('Size of contents (' + byteContents.length +
                      ') does not match byte range ([' + startByte + ', ' + endByte + '])');
    }

    // Validate all bytes before setting any of them to prevent partial updates
    byteContents.forEach(function(byte) {
      if (isNaN(byte)) {
        throw new Error('Values to set must be numbers');
      }
    });

    byteContents.forEach(function(byte, index) {
      this._arr[startByte + index] = byte;
    }.bind(this));
  }

  getByte(byteNumber) {
    return this.getBytes(byteNumber, byteNumber)[0];
  }

  setByte(byteNumber, value) {
    this.setBytes(byteNumber, byteNumber, [value]);
  }

  _calculateChecksum() {
    var checksum = 0;

    for (var i = 16; i >= 0; i--) {
      checksum = (checksum + this._arr[i]) % 256;
    }

    return checksum;
  }

  validateChecksum() {
    var checksum = this._calculateChecksum();

    if (checksum !== this._arr[CHECKSUM_BYTE]) {
      throw new Error("Expected checksum (" + checksum.toString(2) + ") to match password's checksum byte (" + this._arr[CHECKSUM_BYTE].toString(2) + ")");
    }
  }

  fixChecksum() {
    var checksum = this._calculateChecksum();
    this._arr[CHECKSUM_BYTE] = checksum;
  }

  // Note to self; this comes from GPLv3 code (mpg v1.0a), so we'll have to set the license accordingly
  rotateLeft() {
    var carry = 1;
    var carryTemp;
    var rotateAmount = this._arr[SHIFT_BYTE];

    for (var i = 0; i < rotateAmount; i++) {
      var temp = this._arr[15];

      for (var j = 15; j >= 0; j--) {
        carryTemp = (this._arr[j] & 0x80) >>> 7;
        this._arr[j] = ((this._arr[j] << 1) & 0xff) | (carry & 0x1);
        carry = carryTemp;
      }

      carryTemp = (temp & 0x80) >>> 7;
      temp = ((temp << 1) & 0xff) | (carry & 0x1);
      carry = carryTemp;

      this._arr[15] = temp;
    }
  }

  rotateRight() {
    var carry = 1;
    var carryTemp;
    var rotateAmount = this._arr[SHIFT_BYTE];

    for (var i = 0; i < rotateAmount; i++) {
      var temp = this._arr[0];

      for (var j = 0; j < 16; j++) {
        carryTemp = this._arr[j] & 0x1;
        this._arr[j] = (this._arr[j] >>> 1) | ((carry & 0x1) << 7);
        carry = carryTemp;
      }

      carryTemp = temp & 0x1;
      temp = (temp >>> 1) | ((carry & 0x1) << 7);
      carry = carryTemp;
      this._arr[0] = temp;
    }
  }
}

export default BitBuffer;
