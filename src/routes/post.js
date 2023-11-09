const express = require("express");
const router = express.Router();

const pool = require("../utils/mysql");

router.get("/search", async (req, res) => {
  const method = req.query.method;
  const category = req.query.category;
  const keyword = req.query.keyword;
  const page = req.query.page ?? "1";

  if (method === "1") {
    // 제목 + 내용을 통한 검색
    // category = 1, 2, 3 1 = 자유, 2 = 거래, 3 = 이벤트
    // keyword = 검색어
    // page = 페이지
    // 최대 6개의 게시글
    const [posts1] = await pool.query(`
    SELECT *
    FROM post
    WHERE category = ${category}
    AND (title LIKE '%${keyword}%' OR content LIKE '%${keyword}%')
    ORDER BY reg_date DESC
    LIMIT 6
    OFFSET ${(page - 1) * 6}
    `);
    res.send(posts1);
  } else {
    // 작성자 닉네임을 통한 검색
    // category = 1, 2, 3 1 = 자유, 2 = 거래, 3 = 이벤트
    // keyword = 검색어
    // page = 페이지
    // 최대 6개의 게시글
    const [posts2] = await pool.query(`
    SELECT *
    FROM post
    WHERE category = ${category}
    AND owner_nickname LIKE '%${keyword}%'
    ORDER BY reg_date DESC
    LIMIT 6
    OFFSET ${(page - 1) * 6}
    `);
    res.send(posts2);
  }
});

router.get("/", async (req, res) => {
  try {
    const area = req.query.area ?? "성복동";
    const [free] = await pool.query(
      `SELECT *
      FROM post
      WHERE reg_date >= NOW() - INTERVAL 1 WEEK
      AND area = '${area}'
      AND category = ${1}
      ORDER BY favorite_count DESC
      LIMIT 5;
      `
    );
    const [trade] = await pool.query(
      `SELECT *
      FROM post
      WHERE area = '${area}'
      AND category = ${2}
      ORDER BY reg_date DESC
      LIMIT 5;
      `
    );

    const [event] = await pool.query(
      `SELECT *
      FROM post
      WHERE area = '${area}'
      AND category = ${3}
      ORDER BY favorite_count DESC
      LIMIT 5;
      `
    );
    res.send([...trade, ...free, ...event]);
  } catch (error) {
    console.error(error);
  }
});

router.get("/main", async (req, res) => {
  const page = req.query.page ?? "1";
  const category = req.query.category;
  const area = req.query.area;
  const [posts] = await pool.query(`
  SELECT *
  FROM post
  WHERE category = ${category}
  AND area = '${area}'
  ORDER BY timestamp DESC
  LIMIT 6
  OFFSET ${(page - 1) * 6}
  `);
  res.send(posts);
});

router.get("/count", async (req, res) => {
  try {
    const category = req.query.category;
    const area = req.query.area;
    const [count] = await pool.query(`
  SELECT COUNT(*) AS count
  FROM post
  WHERE category = ${category}
  AND area = '${area}'
  `);
    res.send(count[0].count.toString());
  } catch (error) {
    console.error(error);
  }
});

router.post("/get/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const email = req.body.email;

    const [visited] = await pool.query(`
  SELECT *
  FROM visit
  WHERE user_id = "${email}"
  AND post_id = ${id}
  `);

    if (visited.length === 0) {
      await pool.query(`
    UPDATE post
    SET view_count = view_count + 1
    WHERE post_id = ${id}
    `);

      await pool.query(`
    INSERT INTO visit (post_id, user_id)
    VALUES (${id}, '${email}')
    `);
    }

    const [post] = await pool.query(`
  SELECT *
  FROM post
  WHERE post_id = ${id}
  `);

    const [comments] = await pool.query(`
  SELECT *
  FROM comment
  WHERE post_id = ${id}
  ORDER BY comment_id DESC
  `);
    const [user] = await pool.query(`
  SELECT *
  FROM user
  WHERE id = '${post[0].owner_id}'
  `);

    res.send({
      post: post[0],
      comments,
      user: user[0],
    });
  } catch (error) {
    console.error(error);
  }
});

router.get("/image/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT image FROM post WHERE post_id = ?",
      [req.params.id]
    );
    if (rows.length > 0) {
      const imageBuffer = rows[0].image;
      const imageBase64 = imageBuffer.toString("base64");
      const isJpeg = imageBase64.startsWith("/9j/");

      if (isJpeg) {
        res.setHeader("Content-Type", "image/jpeg");
      } else {
        res.setHeader("Content-Type", "image/png");
      }
      res.send(Buffer.from(imageBase64, "base64"));
    } else {
      res.status(404).send("Image not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

router.patch("/image/:id", async (req, res) => {
  const id = req.params.id;
  const image = req.body.image;
  try {
    let buffer;

    if (!image) {
      buffer = null;
    } else {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    }

    await pool.query(
      `
    UPDATE post
    SET image = ?
    WHERE post_id = ${id}
    `,
      [buffer]
    );

    res.send({ message: "이미지 수정 성공", success: true });
  } catch (e) {
    res.send({ message: "이미지 수정 실패", success: false });
  }
});

router.post("/", async (req, res) => {
  try {
    const title = req.body.title;
    const content = req.body.content;
    const category = req.body.category;
    const email = req.body.email;
    const image = req.body.image;
    const now = new Date();

    let buffer;

    if (!image) {
      buffer = null;
    } else {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    }

    const [user] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = '${email}'
    `);

    const area = user[0].user_area;
    const nickname = user[0].nick_name;

    // ISO 문자열로 변환합니다 (예: "2023-11-06T14:19:07.000Z").
    const isoString = now.toISOString();

    // 날짜 부분만 잘라냅니다 ("2023-11-06").
    const dateString = isoString.split("T")[0];
    await pool.query(
      `
    INSERT INTO post (title, content, category, area, owner_id, view_count, favorite_count, comment_count, reg_date, image, owner_nickname)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        title,
        content,
        category,
        area,
        email,
        0,
        0,
        0,
        dateString,
        buffer,
        nickname,
      ]
    );

    res.send({ message: "게시글 작성 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.post("/:id/comment", async (req, res) => {
  const id = req.params.id;
  const content = req.body.content;
  const email = req.body.email;

  try {
    const [user] = await pool.query(`
    SELECT *
    FROM user
    WHERE id = '${email}'
    `);

    await pool.query(`
    INSERT INTO comment (post_id, content, owner_id, owner_nickname)
    VALUES (${id}, '${content}', '${email}', '${user[0].nick_name}')
    `);
    await pool.query(`
    UPDATE post
    SET comment_count = comment_count + 1
    WHERE post_id = ${id}
    `);
    res.send({ message: "댓글 작성 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.delete("/:id/comment/:commentId", async (req, res) => {
  const id = req.params.id;
  const commentId = req.params.commentId;
  try {
    await pool.query(`
    DELETE FROM comment
    WHERE comment_id = ${commentId}
    `);
    await pool.query(`
    UPDATE post
    SET comment_count = comment_count - 1
    WHERE post_id = ${id}
    `);
    res.send({ message: "댓글 삭제 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const title = req.body.title;
  const content = req.body.content;
  try {
    await pool.query(`
    UPDATE post
    SET title = '${title}', content = '${content}'
    WHERE post_id = ${id}
    `);
    res.send({ message: "게시글 수정 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.patch("/:id/pickup", async (req, res) => {
  const id = req.params.id;

  try {
    const [done] = await pool.query(`
    SELECT *
    FROM pickup
    WHERE post_id = ${id}
    `);

    // post reg_date 가 현재 날짜 기준 1주일 이 지났는지 확인

    // 1주일 지났으면 pickup 테이블에 추가

    // 1주일 지나지 않았으면 pickup 테이블에 추가하지 않음

    const [post] = await pool.query(`
    SELECT *
    FROM post
    WHERE post_id = ${id}
    `);

    const regDate = new Date(post[0].reg_date);
    const now = new Date();

    const diff = now.getTime() - regDate.getTime();

    const diffDays = diff / (1000 * 3600 * 24);

    if (diffDays >= 7 && done.length === 0) {
      await pool.query(`
      UPDATE post
      SET timestamp = NOW()
      WHERE post_id = ${id}
      `);
      await pool.query(`
      INSERT INTO pickup (post_id)
      VALUES (${id})
      `);
      res.send({ message: "게시글 수정 성공", success: true });
    } else {
      res.send({ message: "픽업이 불가능한 게시물 입니다.", success: false });
    }
  } catch (error) {
    console.error(error);
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query(`
    DELETE FROM post
    WHERE post_id = ${id}
    `);
    res.send({ message: "게시글 삭제 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

router.patch("/:id/favorite/count", async (req, res) => {
  const id = req.params.id;
  const email = req.body.email;
  try {
    const [done] = await pool.query(`
    SELECT *
    FROM favorite
    WHERE post_id = ${id}
    AND user_id = '${email}'
    `);

    if (done.length === 0) {
      await pool.query(`
      INSERT INTO favorite (post_id, user_id)
      VALUES (${id}, '${email}')
      `);
      await pool.query(`
      UPDATE post
      SET favorite_count = favorite_count + 1
      WHERE post_id = ${id}
      `);
      res.send({ message: "좋아요 성공", success: true });
    } else {
      res.send({
        message: "이미 좋아요를 누른 게시글 입니다.",
        success: false,
      });
    }
  } catch (error) {
    console.error(error);
  }
});

router.delete("/image/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    await pool.query(`
    UPDATE post
    SET image = NULL
    WHERE post_id = ${postId}
    `);
    res.send({ message: "이미지 삭제 성공", success: true });
  } catch (error) {
    res.send({ message: "이미지 삭제 실패", success: false });
  }
});

module.exports = router;
