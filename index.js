// 當 LINE BOT 接收到訊息，會自動執行 doPost
function doPost(e) {
  // 填入 LINE API Token
  var CHANNEL_ACCESS_TOKEN = ''; // 填入 LINE BOT Access Token
  // 以 JSON 格式解析 User 端傳來的 e 資料
  var msg = JSON.parse(e.postData.contents);

  // 從接收到的訊息中取出 replyToken 和發送的訊息文字，詳情請看 LINE 官方 API 說明文件
  const userMessage = msg.events[0];
  const replyToken = userMessage.replyToken; // 回覆的 token
  // 抓取使用者傳的訊息內容
  const userText = userMessage.message.type === 'text' ? userMessage.message.text : undefined;
  // 抓取使用者傳的貼圖內容
  const userSticker =
    userMessage.message.type === 'sticker'
      ? `${userMessage.message.packageId}_${userMessage.message.stickerId}`
      : undefined;
  const user_id = userMessage.source.userId; // 抓取使用者的 ID
  const event_type = userMessage.source.type; // 分辨是個人聊天室還是群組

  // 填入 Google 試算表連結
  const sheetUrl = '';
  // 填入工作表名稱
  const sheetName = '';
  const sheet = SpreadsheetApp.openByUrl(sheetUrl);
  const record = sheet.getSheetByName(sheetName);

  const messages = [];

  const getText = (text) => ({
    type: 'text',
    text,
  });

  const appendTextToMessages = (text) => messages.push(getText(text));

  //回傳 JSON 給 LINE 並傳送給使用者
  function reply() {
    var url = 'https://api.line.me/v2/bot/message/reply';
    UrlFetchApp.fetch(url, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      method: 'post',
      payload: JSON.stringify({
        replyToken,
        // 將輸入值 word 轉為 LINE 文字訊息格式之 JSON
        messages,
      }),
    });
  }

  const getDateText = (date) => `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

  const addCurrentCount = () => {
    const currentCount = record.getRange(currentRow, 2);
    currentCount.setValue(currentCount.getValue() + 1);
  };

  const currentRow = record.getLastRow();

  // 進入正題
  if (userSticker) {
    const prevSticker = record.getRange(1, 3).getValue();

    if (prevSticker === userSticker) {
      addCurrentCount();
    } else {
      let lastRecordDate = new Date(record.getRange(currentRow, 1).getValue());
      // print the data of the last day
      appendTextToMessages(
        `* ${getDateText(lastRecordDate)} *  ${record.getRange(currentRow, 2).getValue()}`
      );

      record.getRange(1, 3).setValue(userSticker);
      const now = new Date();
      const today = getDateText(now);

      if (lastRecordDate.valueOf() === new Date(today).valueOf()) {
        addCurrentCount();
      } else {
        while (lastRecordDate.valueOf() !== new Date(today).valueOf()) {
          lastRecordDate = new Date(lastRecordDate.valueOf() + 24 * 60 * 60 * 1000);
          // 最後一天到今天之內的日期要補 0
          sheet.appendRow([getDateText(lastRecordDate), 0]);
          appendTextToMessages(
            `* ${getDateText(lastRecordDate)} *  ${record
              .getRange(record.getLastRow(), 2)
              .getValue()}`
          );
        }

        record.getRange(record.getLastRow(), 2).setValue(1);
      }

      // 移出當天的紀錄訊息，因為還沒結算
      messages.pop();
    }
  } else if (userText) {
    if (/[0-9]\/[0-9]\/[0-9]/.test(userText)) {
      // 跟日期有關
      const [date, count] = userText.split(' ');

      const recordRow =
        record
          .getRange(1, 1, currentRow, 1)
          .getValues()
          .flat()
          .map((d) => getDateText(new Date(d)))
          .indexOf(date) + 1;

      if (recordRow > 0) {
        if (count === undefined) {
          // get count
          const recordCount = record.getRange(recordRow, 2).getValue();
          appendTextToMessages(`* ${date} *  ${recordCount}`);
        } else {
          // set count
          const recordCount = record.getRange(recordRow, 2).setValue(count);
          appendTextToMessages(`* ${date} *  ${count}`);
        }
      } else {
        appendTextToMessages('No record');
      }
    } else if (userText === 'help') {
      // 純文字
      appendTextToMessages(
        '💖 commands: \n' +
          "1. sticker - use the same sticker to record the counts(can't use the same one to record the data of the relative dates)\n" +
          '2. {{year}}/{{month}}/{{date}} - to get the data of specific date\n' +
          '3. {{year}}/{{month}}/{{date}} {{count}} - to set the data of specific date with {{count}}\n' +
          '4. list {{count}} - to see the data of previous {{count}} record. the default count is 7.'
      );
    } else if (userText.startsWith('list')) {
      // 看列表
      const [_, count = 7] = userText.split(' ');
      const list = record
        .getRange(currentRow - (count - 1), 1, count, 1)
        .getValues()
        .flat()
        .map(
          (d, i) =>
            `* ${getDateText(new Date(d))} *  ${record
              .getRange(currentRow - (count - 1) + i, 2)
              .getValue()}`
        )
        .join('\n');

      appendTextToMessages(list);
    } else {
      // 純文字
      appendTextToMessages('Type *help* to see the commands');
    }
  }

  reply();
}
