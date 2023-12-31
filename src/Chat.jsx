import { useContext, useEffect, useRef, useState } from "react"; // Import necessary dependencies and hooks from React
import Logo from "./Logo"; // Import the Logo component
import { UserContext } from "./UserContext.jsx"; // Import the UserContext from UserContext.jsx file
import { uniqBy } from "lodash"; // Import the uniqBy function from Lodash library
import axios from "axios"; // Import the axios library for making HTTP requests
import Contact from "./Contact"; // Import the Contact component
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperclip, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
export default function Chat() {
  // Declare the functional component named Chat
  const [ws, setWs] = useState(null); // Declare a state variable "ws" to hold the WebSocket connection
  const [onlinePeople, setOnlinePeople] = useState({}); // Declare a state variable "onlinePeople" to hold online users
  const [offlinePeople, setOfflinePeople] = useState({}); // Declare a state variable "offlinePeople" to hold offline users
  const [selectedUserId, setSelectedUserId] = useState(null); // Declare a state variable "selectedUserId" to store the ID of the selected user
  const [newMessageText, setNewMessageText] = useState(""); // Declare a state variable "newMessageText" to store the new message text
  const [messages, setMessages] = useState([]); // Declare a state variable "messages" to hold the chat messages
  const { username, id, setId, setUsername } = useContext(UserContext); // Access values from UserContext using useContext hook
  const divUnderMessages = useRef(); // Create a ref to be used for scrolling to the bottom of messages

  useEffect(() => {
    connectToWs(); // Call the function to establish WebSocket connection when the selectedUserId changes
  }, [selectedUserId]);

  function connectToWs() {
    // Function to establish a WebSocket connection
    const ws = new WebSocket("wss://nexttalkbackend-4ixd.onrender.com"); // Create a new WebSocket instance
    setWs(ws); // Update the state variable "ws" with the WebSocket instance
    ws.addEventListener("message", handleMessage); // Add an event listener for incoming messages
    ws.addEventListener("close", () => {
      // Add an event listener for connection close
      setTimeout(() => {
        // Attempt to reconnect after a delay
        console.log("Disconnected. Trying to reconnect.");
        connectToWs();
      }, 1000); // if we reload the file/changed the selcted user then we should again connect to ws
    });
  }

  function showOnlinePeople(peopleArray) {
    // Function to update online people state
    // just adding unique people (peopleArray->contains repeated values also)
    const people = {}; // Create an empty object to store the online people
    peopleArray.forEach(({ userId, username }) => {
      // Iterate over the peopleArray received
      people[userId] = username; // Map userId to username and add it to the "people" object
    });
    setOnlinePeople(people); // Update the state variable "onlinePeople" with the updated object
  }

  function handleMessage(ev) {
    // Parse the incoming message data from JSON format
    const messageData = JSON.parse(ev.data);
    // Log the event and messageData for debugging purposes
    console.log({ ev, messageData });

    /*First we find who is online by matching token which we send in everyones account using cookie and if token is matched we send its username and id in the wss using clients Now this will store the info of all the online users and now in char section we will find all the online users uing the data we send in server and then display them  */
    // Check if the message contains information about online users
    if ("online" in messageData) {
      // If so, update the online people state with the received online user data
      showOnlinePeople(messageData.online);
    }
    // Check if the message contains a text message
    else if ("text" in messageData) {
      // Check if the sender of the message is the currently selected user
      if (messageData.sender === selectedUserId) {
        // If so, update the messages state by adding the received message
        setMessages((prev) => [...prev, { ...messageData }]);
      }
    }
  }

  function logout() {
    // Function to handle logout
    axios
      .post("/logout") // Send a logout request to the server
      .then((res) => {
        setId(null); // Clear the user ID in UserContext
        setUsername(null); // Clear the username in UserContext
      });
  }

  function sendMessage(ev, file = null) {
    // Prevent the default form submission behavior if an event is present
    if (ev) ev.preventDefault();
    // console.log(newMessageText);
    // Send a WebSocket message with the recipient, text, and optional file information
    ws.send(
      JSON.stringify({
        recipient: selectedUserId,
        text: newMessageText,
        file,
      })
    );

    // If a file is present, retrieve the updated messages after sending it
    if (file) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        setMessages(res.data);
      });
    }
    // If no file is present, update the messages state with the new text message
    else {
      setNewMessageText("");
      setMessages((prev) => [
        ...prev,
        {
          text: newMessageText,
          sender: id,
          recipient: selectedUserId,
          _id: Date.now(), //done to sort away the duplicate text
        },
      ]); //storing previous messages
    }
  }

  function sendFile(ev) {
    // Create a FileReader object to read the selected file
    const reader = new FileReader();
    reader.readAsDataURL(ev.target.files[0]); //now this will return base64 data and ot binary data

    // Once the file is loaded, call sendMessage with the file data
    reader.onload = () => {
      sendMessage(null, {
        name: ev.target.files[0].name,
        data: reader.result,
      });
    };
  }

  useEffect(() => {
    // Scroll the message container to the end when the messages change
    const div = divUnderMessages.current;
    if (div) {
      div.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    // Fetch the list of offline people from the server
    axios.get("/people").then((res) => {
      const offlinePeopleArr = res.data
        .filter((p) => p._id !== id)
        .filter((p) => !Object.keys(onlinePeople).includes(p._id));
      // filtering out ourself and online people from all the users
      // Convert the array of offline people into an object with IDs as keys
      const offlinePeople = {};
      offlinePeopleArr.forEach((p) => {
        offlinePeople[p._id] = p;
      });

      // Update the offline people state
      setOfflinePeople(offlinePeople);
    });
  }, [onlinePeople]);

  useEffect(() => {
    // Fetch the messages for the selected user when the selected user changes
    if (selectedUserId) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        // /messages/" + selectedUserId->selecting previous messages between sender and recipient from DB
        setMessages(res.data);
      });
    }
  }, [selectedUserId]);

  // Create a copy of the onlinePeople state excluding the current user
  const onlinePeopleExclOurUser = { ...onlinePeople };
  delete onlinePeopleExclOurUser[id];

  // Remove duplicate messages based on their unique ID (_id)
  const messagesWithoutDupes = uniqBy(messages, "_id");

  return (
    <div className="flex h-screen">
      <div className=" bg-white w-1/3 flex flex-col">
        <Logo name={username} />
        <div className="overflow-y-scroll border-t">
          {Object.keys(onlinePeopleExclOurUser).map(
            (
              userId //showing log for each online user
            ) => (
              <Contact
                key={userId}
                id={userId}
                online={true}
                username={onlinePeopleExclOurUser[userId]}
                onClick={() => {
                  setSelectedUserId(userId);
                  console.log({ userId });
                }}
                isProfile={false}
                selected={userId === selectedUserId}
              />
            )
          )}
          {Object.keys(offlinePeople).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={false}
              isProfile={false}
              username={offlinePeople[userId].username}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
        </div>
        <div className="p-2 text-center absolute bottom-0">
          <button
            onClick={logout}
            className="text-sm bg-[#e1e6fc] py-2 px-2 text-gray-500 border border-[#667eea] rounded-full"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="flex flex-col w-2/3">
        {!!selectedUserId && (
          <div className="bg-[#667eea]  h-14 flex item-center">
            {onlinePeopleExclOurUser[selectedUserId] ? (
              <Contact
                key={selectedUserId}
                id={selectedUserId}
                online={true}
                username={onlinePeopleExclOurUser[selectedUserId]}
                selected={false}
                isProfile={true}
              />
            ) : (
              <Contact
                key={selectedUserId}
                id={selectedUserId}
                online={false}
                username={offlinePeople[selectedUserId].username}
                selected={false}
                isProfile={true}
              />
            )}
          </div>
        )}
        <div className="flex flex-col bg-[#ebeefc] h-full  p-2">
          <div className="flex-grow">
            {/* IF WE DO NOT SELECT ANY PERSON YET TO CHAT */}
            {!selectedUserId && (
              <div className="flex h-full flex-grow items-center justify-center">
                <div className="text-gray-300">
                  &larr; Select a person from the sidebar
                </div>
              </div>
            )}
            {/* If user is selected show all messages */}
            {!!selectedUserId && (
              <div className="relative h-full">
                <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2 overflow-x-hidden">
                  {messagesWithoutDupes.map((message) => (
                    <div
                      key={message._id}
                      className={
                        message.sender === id ? "text-right" : "text-left"
                      }
                    >
                      <div
                        className={
                          "text-left inline-block p-2 my-2 rounded-md text-sm " +
                          (message.sender === id
                            ? "bg-[#667eea] text-white"
                            : "bg-white text-gray-500")
                        }
                      >
                        {message.text}
                        {message.file && (
                          <div className="">
                            <a
                              target="_blank"
                              className="flex items-center gap-1 border-b"
                              href={
                                axios.defaults.baseURL +
                                "/uploads/" +
                                message.file
                              }
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {message.file}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={divUnderMessages}></div>
                </div>
              </div>
            )}
          </div>
          {/* !!selectedUserId->DONE TO CONVERT INTO BOOLEAN  */}
          {!!selectedUserId && (
            <form className="flex gap-2" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessageText}
                onChange={(ev) => setNewMessageText(ev.target.value)}
                placeholder="Type your message here"
                className="bg-white w-full border rounded-full p-2 "
              />
              <label className="bg-[#c8d1fa] p-2 text-gray-600 h-10 w-10 cursor-pointer rounded-full border border-blue-200">
                <input type="file" className="hidden" onChange={sendFile} />

                <FontAwesomeIcon icon={faPaperclip} className="h-5 w-5 " />
              </label>
              <button
                type="submit"
                disabled={newMessageText.length < 1}
                className="bg-[#667eea] p-2 h-10 w-10 text-white rounded-full"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
/////
