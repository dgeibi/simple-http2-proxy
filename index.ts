import proxy from "http2-proxy";
import finalhandler from "finalhandler";
import type {
  IncomingMessage,
  ServerResponse,
  Server as HttpServer,
} from "http";
import type { Socket, Server } from "net";
import type {
  Http2ServerRequest,
  Http2ServerResponse,
  Http2Server,
} from "http2";

const defaultWebHandler = (err, req, res) => {
  if (err) {
    finalhandler(req, res)(err);
  }
};

const defaultWSHandler = (err, req, socket, head) => {
  if (err) {
    socket.destroy();
  }
};

function createProxy<T extends Http2Server>(options: {
  server: T;
  webProxy: proxy.http2WebOptions;
  wsProxy: proxy.wsHttp2Options;
  webCallback?: (
    err: Error,
    req: Http2ServerRequest,
    res: Http2ServerResponse
  ) => void;
  wsCallback?: (
    err: Error,
    req: Http2ServerRequest,
    socket: Socket,
    head: Buffer
  ) => void;
  bypassHost?: boolean;
}): void;
function createProxy<T extends HttpServer>(options: {
  server: T;
  webProxy: proxy.http1WebOptions;
  wsProxy: proxy.wsHttp1Options;
  webCallback?: (err: Error, req: IncomingMessage, res: ServerResponse) => void;
  wsCallback?: (
    err: Error,
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => void;
  bypassHost?: boolean;
}): void;
function createProxy<T extends Server>({
  server,
  webProxy,
  wsProxy,
  webCallback = defaultWebHandler,
  wsCallback = defaultWSHandler,
  bypassHost = false,
}: {
  server: T;
  webProxy: any;
  wsProxy: any;
  webCallback?: (err: Error, req: any, res: any) => void;
  wsCallback?: (err: Error, req: any, socket: Socket, head: Buffer) => void;
  bypassHost?: boolean;
}) {
  server.on("request", (req, res) => {
    proxy.web(
      req,
      res,
      bypassHost
        ? {
            ...webProxy,
            ...getTarget(req.headers[":authority"] || req.headers.host),
          }
        : webProxy,
      webCallback
    );
  });
  server.on("upgrade", (req, socket, head) => {
    proxy.ws(
      req,
      socket,
      head,
      bypassHost
        ? {
            ...wsProxy,
            ...getTarget(req.headers[":authority"] || req.headers.host),
          }
        : wsProxy,
      wsCallback
    );
  });
  server.on("secureConnection", (sock) => {
    sock.on("error", (err) => {
      if (err.code === "ECONNRESET" || err.code === "EPIPE") {
        return;
      }
      throw err;
    });
  });
}

export { createProxy };

function getTarget(host: string) {
  if (host) {
    const { hostname, error } = parseHost(host);
    if (error) {
      throw new Error(error);
    }
    return {
      hostname,
    };
  }
  return {};
}

function parseHost(hostString: string) {
  let hostname = null;
  let port = null;

  // 检查是否包含端口号
  if (hostString.includes(":")) {
    // 分割主机名和端口号
    const parts = hostString.split(":");

    // 如果有多个冒号，则说明是 IPv6 地址
    if (parts.length > 2) {
      hostname = parts.slice(0, -1).join(":"); // IPv6 地址
      port = parseInt(parts.slice(-1)[0], 10);
    } else {
      hostname = parts[0]; // 主机名
      port = parseInt(parts[1], 10); // 端口号
    }
  } else {
    // 没有端口号，则整个字符串是主机名
    hostname = hostString;
    port = null;
  }

  // 验证端口号是否有效
  if (port !== null && (isNaN(port) || port < 1 || port > 65535)) {
    return {
      hostname: null,
      port: null,
      error: "Invalid port number",
    };
  }

  return { hostname, port, error: null };
}
