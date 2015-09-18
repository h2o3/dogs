var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var crypto = require('crypto');
var stream = require('stream');
var reader = require('./reader');
var ALGORITHM = 'aes-256-cbc';
var EncryptStream = (function (_super) {
    __extends(EncryptStream, _super);
    function EncryptStream(password) {
        _super.call(this);
        this.password = password;
    }
    EncryptStream.prototype._transform = function (data, enc, callback) {
        var chunk;
        if (data instanceof Buffer) {
            chunk = data;
        }
        else {
            chunk = new Buffer(data);
        }
        var clipher = crypto.createCipher(ALGORITHM, this.password);
        var encrypted = clipher.update(chunk);
        var finalEncrypted = clipher.final();
        var lenBuffer = new Buffer(4);
        lenBuffer.writeUInt32BE(encrypted.length + finalEncrypted.length, 0);
        this.push(lenBuffer);
        this.push(encrypted);
        this.push(finalEncrypted);
        callback();
    };
    return EncryptStream;
})(stream.Transform);
exports.EncryptStream = EncryptStream;
var DecryptStream = (function (_super) {
    __extends(DecryptStream, _super);
    function DecryptStream(password) {
        var _this = this;
        _super.call(this);
        this.reader = new reader.Reader([
            {
                state: 0,
                count: function () { return 4; },
                action: function (cb, buffer) {
                    _this.packetLength = buffer.readUInt32BE(0);
                    cb(1);
                }
            },
            {
                state: 1,
                count: function () { return _this.packetLength; },
                action: function (cb, buffer) {
                    _this.packetBody = buffer.slice(0, _this.packetLength);
                    cb(2);
                }
            },
            {
                state: 2,
                count: function () { return 0; },
                action: function (cb, buffer) {
                    var decipher = crypto.createDecipher(ALGORITHM, _this.password);
                    try {
                        var decrypted = decipher.update(_this.packetBody);
                        var finalDecrypted = decipher.final();
                        _this.push(decrypted);
                        _this.push(finalDecrypted);
                        cb(0);
                    }
                    catch (e) {
                        console.error('decrypt error:', e);
                        cb(3);
                    }
                }
            },
            {
                state: 3,
                count: function () { return 0; },
                action: function (cb, buffer) {
                    _this.end();
                }
            }
        ]);
        this.password = password;
    }
    DecryptStream.prototype._transform = function (data, enc, callback) {
        var chunk;
        if (data instanceof Buffer) {
            chunk = data;
        }
        else {
            chunk = new Buffer(data);
        }
        this.reader.feed(chunk);
        this.reader.consumeAll();
        callback();
    };
    return DecryptStream;
})(stream.Transform);
exports.DecryptStream = DecryptStream;
//# sourceMappingURL=secure.js.map