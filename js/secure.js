var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
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
        _super.call(this);
        this.reader = new reader.Reader();
        this.password = password;
    }
    DecryptStream.prototype._transform = function (data, enc, callback) {
        var _this = this;
        var chunk;
        if (data instanceof Buffer) {
            chunk = data;
        }
        else {
            chunk = new Buffer(data);
        }
        this.reader.feed(chunk);
        this.reader.consumeAll([
            {
                state: 0,
                target: 1,
                count: function () { return 4; },
                action: function (buffer) {
                    _this.packetLength = buffer.readUInt32BE(0);
                }
            },
            {
                state: 1,
                target: 2,
                count: function () { return _this.packetLength; },
                action: function (buffer) {
                    _this.packetBody = buffer.slice(0, _this.packetLength);
                }
            },
            {
                state: 2,
                target: 0,
                count: function () { return 0; },
                action: function (buffer) {
                    var decipher = crypto.createDecipher(ALGORITHM, _this.password);
                    try {
                        var decrypted = decipher.update(_this.packetBody);
                        var finalDecrypted = decipher.final();
                        _this.push(decrypted);
                        _this.push(finalDecrypted);
                    }
                    catch (e) {
                        console.error('decrypt error:', e);
                        _this.end();
                    }
                }
            }
        ]);
        callback();
    };
    return DecryptStream;
})(stream.Transform);
exports.DecryptStream = DecryptStream;
//# sourceMappingURL=secure.js.map