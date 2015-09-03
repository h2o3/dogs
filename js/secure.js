var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var crypto = require('crypto');
var stream = require('stream');
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
        this.buffers = [];
        this.buffered = 0;
        this.state = 0;
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
        this.buffers.push(chunk);
        this.buffered += chunk.length;
        while (true) {
            if (this.state == 0) {
                if (!this.consumeBuffer(4, function (buffer) {
                    return _this.packetLength = buffer.readUInt32BE(0);
                }))
                    break;
                this.state = 1;
            }
            if (this.state == 1) {
                if (!this.consumeBuffer(this.packetLength, function (buffer) {
                    return _this.packetBody = buffer.slice(0, _this.packetLength);
                }))
                    break;
                this.state = 2;
            }
            if (this.state == 2) {
                var decipher = crypto.createDecipher(ALGORITHM, this.password);
                var decrypted = decipher.update(this.packetBody);
                var finalDecrypted = decipher.final();
                this.push(decrypted);
                this.push(finalDecrypted);
                this.state = 0;
            }
        }
        callback();
    };
    DecryptStream.prototype.consumeBuffer = function (size, action) {
        if (this.buffered >= size) {
            var buffer = Buffer.concat(this.buffers);
            action(buffer);
            this.buffered -= size;
            this.buffers = [buffer.slice(size)];
            return true;
        }
        else {
            return false;
        }
    };
    return DecryptStream;
})(stream.Transform);
exports.DecryptStream = DecryptStream;
//# sourceMappingURL=secure.js.map