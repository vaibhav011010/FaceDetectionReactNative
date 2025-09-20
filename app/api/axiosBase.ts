// axiosBase.ts
import axios from "axios";

const API_BASE_URL = "https://quikcheckapi.site";

const axiosBase = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 20 sec timeout
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosBase;
