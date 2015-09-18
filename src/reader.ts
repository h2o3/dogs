export interface ConsumeCb<S> {
	(target: S): void;
}

export interface ConsumeSpec<S> {
	state: S;
	count: () => number;
	action: (cb: ConsumeCb<S>, buffer?: Buffer) => void;
}

export class Reader<S> {
	private specs: Array<ConsumeSpec<S>>;
	private idle: boolean = true;

	private buffers: Array<Buffer> = [];
	private buffered: number = 0;

	state: S;

	constructor(initial: S, specs: Array<ConsumeSpec<S>>) {
		this.state = initial;
		this.specs = specs;
	}

	feed(buffer: Buffer) {
		this.buffers.push(buffer);
		this.buffered += buffer.length;
	}

	protected comsumeCb(target: S) {
		this.state = target;
		this.idle = true;

		process.nextTick(() => {
			this.consumeAll();
		});
	}

	consumeAll() {
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
						} else {
							this.buffered -= requirement;
							this.buffers = [buffer.slice(requirement)];
						}

						spec.action(this.comsumeCb.bind(this), buffer);
					} else {
						this.idle = true;
					}

					break;
				}
			}
		}
	}

	remain(): Buffer {
		return Buffer.concat(this.buffers);
	}
}