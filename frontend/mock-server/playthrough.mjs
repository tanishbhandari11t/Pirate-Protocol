// Plays a two-sailor voyage end to end against the practice harbour.
import { io } from "socket.io-client";

const URL = process.env.SOCKET_URL ?? "http://localhost:4000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sailor() {
  const socket = io(URL, { transports: ["websocket"] });
  const hand = { socket, voyage: null };
  socket.on("voyage:state", (v) => (hand.voyage = v));