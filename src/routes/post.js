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
    AND writer_nickname LIKE '%${keyword}%'
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
  ORDER BY reg_date DESC
  LIMIT 6
  OFFSET ${(page - 1) * 6}
  `);
  res.send(posts);
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;

  await pool.query(`
  UPDATE post
  SET view_count = view_count + 1
  WHERE post_id = ${id}
  `);

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
});

router.post("/", async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const category = req.body.category;
  const area = req.body.area;
  const email = req.body.email;
  try {
    await pool.query(`
    INSERT INTO post (title, content, category, area, owner_id, view_count, favorite_count, comment_count)
    VALUES ('${title}', '${content}', ${category}, ${area}, '${email}', 0, 0, 0)
    `);
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
  try {
    await pool.query(`
    UPDATE post
    SET favorite_count = favorite_count + 1
    WHERE post_id = ${id}
    `);
    res.send({ message: "좋아요 수 변경 성공", success: true });
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;
