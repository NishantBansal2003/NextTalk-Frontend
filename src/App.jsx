import axios from "axios";
import { UserContextProvider } from "./UserContext";
import Routes from "./Routes";

function App() {
  // axios.defaults.baseURL = "http://localhost:4040";
  axios.defaults.baseURL = "https://nexttalkbackend-4ixd.onrender.com";
  axios.defaults.withCredentials = true; //used to send cookie from server
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
}

export default App;
