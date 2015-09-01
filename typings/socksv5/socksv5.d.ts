declare module "socksv5" {
	import net = require('net');

	export interface ConnInfo {
		srcAddr: string;
		srcPort: number;
		dstAddr: string;
		dstPort: number;
	}

	export interface AuthHandler { }

	export interface Server {
		useAuth(authHandler: AuthHandler);
		listen(port: number, host?: string, listener?: () => void);
	}

	export function createServer(listener?: (info: ConnInfo, accept: (boolean?) => net.Socket, deny: () => void) => void): Server;

	interface Auth {
		None(): AuthHandler;
		UserPassword(callback: (user: string, password: string) => boolean): AuthHandler;
	}
	export var auth: Auth;
}