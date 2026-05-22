import { startWebSocketServer } from "./websocket";

const port = parseInt(process.env.WS_PORT || "3001", 10);

startWebSocketServer(port);

console.log(`WebSocket 服务器运行在端口 ${port}`);
