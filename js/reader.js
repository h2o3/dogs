var Reader = (function () {
    function Reader(initial, specs) {
        this.idle = true;
        this.buffers = [];
        this.buffered = 0;
        this.state = initial;
        this.specs = specs;
    }
    Reader.prototype.feed = function (buffer) {
        this.buffers.push(buffer);
        this.buffered += buffer.length;
    };
    Reader.prototype.comsumeCb = function (target) {
        var _this = this;
        this.state = target;
        this.idle = true;
        process.nextTick(function () {
            _this.consumeAll();
        });
    };
    Reader.prototype.consumeAll = function () {
        if (this.idle) {
            this.idle = false;
            for (var index = 0; index < this.specs.length; index++) {
                var spec = this.specs[index];
                if (spec.state == this.state) {
                    var requirement = spec.count();
                    if (this.buffered >= requirement
                        || (requirement == Number.MAX_VALUE && this.buffered > 0)) {
                        var buffer = Buffer.concat(this.buffers);
                        if (requirement == Number.MAX_VALUE) {
                            this.buffered = 0;
                            this.buffers = [];
                        }
                        else {
                            this.buffered -= requirement;
                            this.buffers = [buffer.slice(requirement)];
                        }
                        spec.action(this.comsumeCb.bind(this), buffer);
                    }
                    else {
                        this.idle = true;
                    }
                    break;
                }
            }
        }
    };
    Reader.prototype.remain = function () {
        return Buffer.concat(this.buffers);
    };
    return Reader;
})();
exports.Reader = Reader;
//# sourceMappingURL=reader.js.map