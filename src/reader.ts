export interface ConsumeCb {
	(target: number): void;
}

export interface ConsumeSpec {
	state: number;
	count: () => number;
	action: (cb: ConsumeCb, buffer?: Buffer) => void;
}

export class Reader {
	private specs: Array<ConsumeSpec>;
	private idle: boolean = true;

	private buffers: Array<Buffer> = [];
	private buffered: number = 0;

	state: number = 0;

	constructor(specs: Array<ConsumeSpec>) {
		this.specs = specs;
	}

	feed(buffer: Buffer) {
		this.buffers.push(buffer);
		this.buffered += buffer.length;
	}

	protected comsumeCb(target: number) {
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

	reset(): void {
		this.state = 0;
	}

	remain(): Buffer {
		return Buffer.concat(this.buffers);
	}
}