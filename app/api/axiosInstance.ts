import axios from "axios";

const API_BASE_URL = "https://webapptest1.site/";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 10 sec timeout
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
