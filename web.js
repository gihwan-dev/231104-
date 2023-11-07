const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);
const io = socketIo(server);
const pool = require("./src/utils/mysql");

const bodyParser = require("body-parser");

var client_id = "8KXeg4eZHdnZEfoBjghJ";
var client_secret = "MzneGT9I5r";
var state = "RANDOM_STATE";
var redirectURI = encodeURI("http://dongnaecomm.cafe24app.com/");
var api_url = "";

const port = process.env.PORT || 3000;

const postRouter = require("./src/routes/post.js");
const userRouter = require("./src/routes/user.js");

app.use(morgan("dev"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors());

app.use(express.static(__dirname + "/src/public"));
// 루트 요청으로 들어오는 요청은 index.html을 보내줌
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/src/public/index.html");
});

app.use("/api/post", postRouter);
app.use("/api/user", userRouter);

io.on("connection", (socket) => {
  console.log("New client connected");

  // 특정 포스트의 채팅방에 참여
  socket.on("joinRoom", async (postId) => {
    socket.join(postId);
    // 이전 채팅 메시지를 불러와 클라이언트에게 전송
    const [messages] = await pool.query(` 
    SELECT *
    FROM chats
    WHERE post_id = ${postId}
    ORDER BY chat_id DESC
    `);

    socket.emit("previousMessages", messages);
  });

  // 클라이언트로부터 채팅 메시지를 받으면 처리
  socket.on("sendMessage", async ({ postId, content, userEmail }) => {
    // DB에서 유저 닉네임 받아오기
    const [user] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = '${userEmail}'
    `);
    const userNickName = user[0].nick_name;

    // DB에 메시지 저장
    await pool.query(`
    INSERT INTO chats (post_id, user_nickname, content)
    VALUES (${postId}, '${userNickName}', '${content}')
    `);

    // 해당 채팅방에 메시지 전송
    io.to(postId).emit("receiveMessage", { postId, content, userNickName });
  });

  socket.on("disconnect", () => {
    console.log("채팅 연결 해제");
  });
});

app.get("/naverlogin", function (req, res) {
  api_url =
    "https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=" +
    client_id +
    "&redirect_uri=" +
    redirectURI +
    "&state=" +
    state;
  res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
  res.end(
    "<a href='" +
      api_url +
      "'><img height='50' src='http://static.nid.naver.com/oauth/small_g_in.PNG'/></a>"
  );
});
app.get("/callback", function (req, res) {
  code = req.query.code;
  state = req.query.state;
  api_url =
    "https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=" +
    client_id +
    "&client_secret=" +
    client_secret +
    "&redirect_uri=" +
    redirectURI +
    "&code=" +
    code +
    "&state=" +
    state;
  var request = require("request");

  var options = {
    url: api_url,
    headers: {
      "X-Naver-Client-Id": client_id,
      "X-Naver-Client-Secret": client_secret,
    },
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
      res.end(body);
    } else {
      res.status(response.statusCode).end();
      console.log("error = " + response.statusCode);
    }
  });
});

server.listen(port, () => {
  console.log(`server is running on ${port} cur time is ${Date.now()}`);
});
