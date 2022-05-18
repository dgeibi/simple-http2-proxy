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
    console.error("proxy error", err);
    finalhandler(req, res)(err);
  }
};

const defaultWSHandler = (err, req, socket, head) => {
  if (err) {
    console.error("proxy error", err);
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
            hostname:
              req.headers[":authority"] ||
              req.headers.host ||
              webProxy.hostname,
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
            hostname:
              req.headers[":authority"] || req.headers.host || wsProxy.hostname,
          }
        : wsProxy,
      wsCallback
    );
  });
}

export { createProxy };
