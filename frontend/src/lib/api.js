import axios from "axios";

const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_API_URL ||
  ""
).replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API,
  timeout: 30000,
});

export const getStatus = () => client.get("/status").then((r) => r.data);
export const getPubKey = () => client.get("/pubkey").then((r) => r.data);
export const getLedger = (params = {}) =>
  client.get("/ledger", { params }).then((r) => r.data);
export const postRandom = (payload) =>
  client.post("/get_random", payload).then((r) => r.data);
export const postSimulate = (payload) =>
  client
    .post("/simulate_universe", payload, { timeout: 120000 })
    .then((r) => r.data);

export default client;
