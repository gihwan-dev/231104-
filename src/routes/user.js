const express = require("express");
const router = express.Router();

const pool = require("../utils/mysql");

const { hash, compare } = require("../utils/hash");

async function fetchWithNodeFetch(url, options) {
  const { default: fetch } = await import("node-fetch");
  return fetch(url, options);
}

router.post("/address", async (req, res) => {
  const email = req.body.email;
  try {
    const [address] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${email}"
    `);
    res.send({ address: address[0].user_area, success: true });
  } catch (error) {
    console.error(error);
    res.send({ message: "주소 인식 실패", success: false });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${req.body.email}"
    `);
    if (user.length === 0) {
      const hashedPassword = await hash(req.body.password);
      await pool.query(`
      INSERT INTO user
      (id, pw, name, nick_name, role)
      VALUES
      ("${req.body.email}","${hashedPassword}", "${req.body.name}", "${req.body.nickname}", 1)
      `);
      res.send({ message: "회원가입 성공", isValid: true });
    } else {
      res.send({ message: "이미 존재하는 이메일입니다.", isValid: false });
    }
  } catch (error) {
    console.error(error);
  }
});

router.post("/signin", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${email}"
    `);
    if (user.length === 0) {
      res.send({ message: "존재하지 않는 이메일입니다.", isValid: false });
    } else {
      const result = await compare(password, user[0].pw);
      if (result) {
        res.send({ message: "로그인 성공", isValid: true });
      } else {
        res.send({ message: "비밀번호가 일치하지 않습니다.", isValid: false });
      }
    }
  } catch (error) {
    console.error(error);
  }
});

router.post("/", async (req, res) => {
  try {
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${req.body.email}"
    `);
    if (user.length === 0) {
      await pool.query(`
      INSERT INTO user
      (id, pw, name, nick_name, role, user_area)
      VALUES
      ("${req.body.email}","naver_login", "${req.body.name}", "${req.body.nickname}", 1, 0)
      `);
    }
    res.send(user);
  } catch (error) {
    console.error(error);
  }
});

router.post("/nickname", async (req, res) => {
  try {
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE nick_name = "${req.body.nickname}"
    `);
    if (user.length === 0) {
      res.send({ isValid: true });
    } else {
      res.send({ isValid: false });
    }
  } catch (error) {
    console.error(error);
  }
});

router.post("/findpw", async (req, res) => {
  try {
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${req.body.email}"
    `);

    if (user.length === 0) {
      res.send({ message: "존재하지 않는 이메일입니다.", isValid: false });
    } else {
      if (user[0].name === req.body.name) {
        res.send({ message: "인증 성공.", isValid: true });
      }
    }
  } catch (error) {
    console.error(error);
  }
});

router.post("/changepw", async (req, res) => {
  try {
    const hashedPassword = await hash(req.body.password);
    await pool.query(`
    UPDATE user
    SET pw = "${hashedPassword}"
    WHERE id = "${req.body.email}"
    `);
    res.send({ message: "비밀번호 변경 성공", isValid: true });
  } catch (error) {
    console.error(error);
  }
});

router.post("/checkpw", async (req, res) => {
  try {
    const [user, _] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${req.body.email}"
    `);
    if (user.length === 0) {
      res.send({ message: "존재하지 않는 이메일입니다.", isValid: false });
    }

    const result = await compare(req.body.password, user[0].pw);
    const [posts, __] = await pool.query(`
    SELECT *
    FROM post
    WHERE owner_id = "${req.body.email}"
    ORDER BY reg_date DESC
    `);

    if (user[0].pw === "naver_login") {
      res.send({
        message: "비밀번호가 일치합니다.",
        isValid: true,
        name: user[0].name,
        nickname: user[0].nick_name,
        email: user[0].id,
        address: user[0].user_area,
        posts,
      });
    }

    if (result) {
      res.send({
        message: "비밀번호가 일치합니다.",
        isValid: true,
        name: user[0].name,
        nickname: user[0].nick_name,
        email: user[0].id,
        address: user[0].user_area,
        posts,
      });
    } else {
      res.send({ message: "비밀번호가 일치하지 않습니다.", isValid: false });
    }
  } catch (error) {
    console.error(error);
  }
});

router.post("/image", async (req, res) => {
  try {
    const data = req.body.image;
    // jpeg 인지 png 인지 확인한다.
    const isJpeg = data.match(/^data:image\/jpeg;base64,/);
    let base64Data;

    if (isJpeg) {
      base64Data = data.replace(/^data:image\/jpeg;base64,/, "");
    } else {
      base64Data = data.replace(/^data:image\/png;base64,/, "");
    }

    const requestBody = {
      version: "V2",
      requestId: Math.random().toFixed(2).toString(),
      timestamp: Date.now(), // 현재 시간의 타임스탬프
      images: [
        {
          format: isJpeg ? "jpeg" : "png",
          name: "test1",
          data: base64Data, // Base64 인코딩된 이미지 데이터
        },
      ],
    };
    const result = await fetchWithNodeFetch(
      "https://zbbo2mg3lo.apigw.ntruss.com/custom/v1/25970/6b28ec0a082310b1527c7ed022d01691bc04f3c0461c997c7b97a6defc0567cf/document/id-card",
      {
        method: "POST",
        headers: {
          "X-OCR-SECRET": "TElBckJLb3JjeWFEZGFzTlVmR1VscXZ0cVVyR3RVak8=",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    const resultJson = await result.json();

    const address = resultJson.images[0].idCard.result.dl.address[0].text;

    const dongRegex = /\(([^)]+동),/; // '동' 으로 끝나는 단어를 괄호 안에서 찾음
    const match = address.match(dongRegex);

    if (match && match[1]) {
      const area = match[1];
      await pool.query(`
    UPDATE user
    SET user_area = "${area}"
    WHERE id = "${req.body.email}"
    `);
      res.send({ message: "주소 인식 성공", isValid: true });
    } else {
      res.send({ message: "주소 인식 실패", isValid: false });
    }
  } catch (error) {
    console.error(error);
    res.send({ message: "주소 인식 실패", isValid: false });
  }
});

router.post("/checkcancomment", async (req, res) => {
  try {
    const postId = req.body.postId;
    const email = req.body.email;
    const [post] = await pool.query(`
    SELECT *
    FROM post
    WHERE post_id = ${postId}
    `);
    const [user] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = "${email}"
    `);
    if (post[0].area !== user[0].user_area) {
      res.send({ message: "댓글을 달 수 없습니다.", success: false });
      return;
    }
    res.send({ message: "댓글을 달 수 있습니다.", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.post("/delete", async (req, res) => {
  try {
    const email = req.body.email;
    await pool.query(`
    DELETE FROM user
    WHERE id = "${email}"
    `);
    res.send({ message: "게시글 삭제 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.post("/findId", async (req, res) => {
  const name = req.body.name;
  const nickname = req.body.nickname;

  try {
    const [user] = await pool.query(`
    SELECT *
    FROM user
    WHERE name = '${name}' AND nick_name = '${nickname}'
    `);
    console.log(user[0]);
    if (user.length === 0) {
      res.send({ message: "존재하지 않는 회원입니다.", success: false });
    } else {
      res.send({ message: user[0].id, success: true, email: user[0].id });
    }
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;
