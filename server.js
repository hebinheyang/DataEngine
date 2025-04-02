// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const predefinedQA = {     "常见高蛋白食物": "优质高蛋白食物包括：鸡胸肉（31g/100g）、鸡蛋（13g/个）、三文鱼（20g/100g）、豆腐（8g/100g）、希腊酸奶（10g/100g）",
                        "低卡零食推荐": "健康低卡零食选择：① 原味杏仁（约6大卡/颗）② 蓝莓（57kcal/100g）③ 魔芋果冻（≈0kcal）④ 小黄瓜（16kcal/100g）⑤ 海苔（40kcal/10g）",
                        "维生素C含量高的水果": "维生素C之王：刺梨（2585mg/100g），常见水果：① 鲜枣（243mg）② 番石榴（228mg）③ 猕猴桃（62mg）④ 草莓（58mg）⑤ 橙子（53mg）",
                        "减脂期饮食建议": "科学减脂饮食要点：1. 保证蛋白质摄入（1.6-2.2g/kg体重）2. 选择低GI碳水 3. 健康脂肪占20-30%总热量 4. 每日热量缺口300-500kcal 5. 配合力量训练",
                        "食物酸碱性的真相": "科学提示：食物酸碱性理论是伪科学！人体血液pH值会自动维持在7.35-7.45，食物不会改变身体酸碱平衡。应注重饮食多样性而非酸碱分类。",
                        "默认回复": "关于食物营养的更多问题，您可以：1. 尽量具体说明食物名称 2. 说明您的需求（如减脂/增肌/特殊饮食）3. 查询《中国居民膳食指南》获取权威建议" };

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// 问答接口
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: '问题不能为空' });

    const answer = findPredefinedAnswer(question);
    if (answer !== predefinedQA.默认回复) {
      return res.json({ answer });
    }

    const response = await openai.chat.completions.create({
      model: "qwen-vl-max",
      messages: [{ role: "user", content: question }]
    });
    
    res.json({ 
      answer: response.choices[0].message.content,
      isAI: true
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '服务器处理请求时发生错误' });
  }
});

// 同原来的 findPredefinedAnswer 函数
function findPredefinedAnswer(question) {     // 标准化处理：转为小写，去除标点
                        const cleanQuestion = question
                            .toLowerCase()
                            .replace(/[.,\/#!?$%\^&\*;:{}=_`~()]/g, "")
                            .trim();

                        // 精确匹配
                        for (const [key, value] of Object.entries(predefinedQA)) {
                            if (cleanQuestion === key.toLowerCase()) {
                                return value;
                            }
                        }

                        // 包含关键词匹配
                        const keywords = {
                            "卡路里": "食物热量查询提示：苹果52kcal/100g，米饭116kcal/100g，鸡胸肉133kcal/100g，查询具体食物热量请说明食物名称",
                            "膳食纤维": "高纤维食物推荐：① 奇亚籽（34.4g/100g）② 黑豆（15.5g）③ 杏仁（12.5g）④ 燕麦（10.6g）⑤ 西兰花（3.7g）",
                            "升糖指数": "GI值解读：低GI（≤55）：全麦食品、豆类；中GI（56-69）：糙米、香蕉；高GI（≥70）：白面包、西瓜。建议搭配蛋白质和膳食纤维食用",
                            "抗氧化": "天然抗氧化食物：① 蓝莓（花青素）② 番茄（番茄红素）③ 黑巧克力（黄烷醇）④ 核桃（褪黑激素）⑤ 绿茶（茶多酚）",
                            "omega3": "Omega-3优质来源：三文鱼（2.3g/100g）、亚麻籽（22.8g/100g）、核桃（9.1g/100g）、奇亚籽（17.8g/100g）、鲭鱼（2.5g/100g）"
                        };

                        for (const [key, value] of Object.entries(keywords)) {
                            if (cleanQuestion.includes(key)) {
                                return value;
                            }
                        }

                        return predefinedQA.默认回复; }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});