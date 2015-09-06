var Reader = (function () {
    function Reader() {
        this.buffers = [];
        this.buffered = 0;
        this.state = 0;
    }
    Reader.prototype.feed = function (buffer) {
        this.buffers.push(buffer);
        this.buffered += buffer.length;
    };
    Reader.prototype.consume = function (size, action, target) {
        if (size == 0) {
            action();
            this.state = target;
            return true;
        }
        else if (this.buffered >= size) {
            var buffer = Buffer.concat(this.buffers);
            action(buffer);
            this.state = target;
            this.buffered -= size;
            this.buffers = [buffer.slice(size)];
            return true;
        }
        else {
            return false;
        }
    };
    Reader.prototype.consumeAll = function (specs) {
        while (true) {
            var broken = false;
            var hasSpec = false;
            for (var index = 0; index < specs.length; index++) {
                var spec = specs[index];
                if (this.state == spec.state) {
                    hasSpec = true;
                    if (!this.consume(spec.count(), spec.action, spec.target)) {
                        broken = true;
                        break;
                    }
                }
            }
            if (!hasSpec || broken)
                break;
        }
    };
    Reader.prototype.reset = function () {
        this.state = 0;
    };
    Reader.prototype.remain = function () {
        return Buffer.concat(this.buffers);
    };
    return Reader;
})();
exports.Reader = Reader;
//# sourceMappingURL=reader.js.map