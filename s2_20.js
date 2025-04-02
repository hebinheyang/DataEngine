
const nutrientConfigs = [
  // 基础配置
  { name: "高纤维", field: "Fiber", threshold: 37, color: "#fc8d62" },
  { name: "高热量", field: "Calories", threshold: 750, color: "#e78ac3" },
  { name: "高维生素C", field: "Vitamin C", threshold: 0.07, color: "#8da0cb" },
  { name: "高钙", field: "Calcium", threshold: 1, color: "#a6d854" },
  { name: "高碳水化合物", field: "Carbs", threshold: 85, color: "#ffd92f" },
  { name: "高胆固醇", field: "Cholesterol", threshold: 0.3, color: "#e5c494" },
  { name: "高脂肪", field: "Fats", threshold: 99, color: "#8dd3c7" },
  { name: "高叶酸", field: "Folate", threshold: 0.0004, color: "#fb8072" },
  { name: "高铁", field: "Iron", threshold: 0.032, color: "#80b1d3" },
  { name: "高蛋白", field: "Protein", threshold: 30, color: "#fccde5" },
  { name: "高钠", field: "Sodium", threshold: 2, color: "#ccebc5" },
  { name: "高维生素A", field: "Vitamin A RAE", threshold: 120E-5, color: "#ffed6f" },
  {
    name: "低维生素C",
    field: "Vitamin C",
    threshold: 0.1,
    color: "#a6cee3",
    inverse: true
  },
  {
    name: "低钙",
    field: "Calcium",
    threshold: 5,
    color: "#fb9a99",
    inverse: true
  }
];

// 全局变量声明
const width = 1600;
const height = 1200;
let link, node, labels, simulation;
let originalLinks = [], originalNodes = [];
let currentNodes = [], currentLinks = [];
let isDataLoaded = false;
let caloriesChart, categoryChart; // 用于保存图表实例

// 创建SVG画布
const svg = d3.select("#graph")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// 工具提示
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// 加载数据
fetch("./foodstruct_nutritional_facts.csv")
  .then(response => response.arrayBuffer())
  .then(buffer => {
    const decoder = new TextDecoder('gbk');//统一编码gbk
    const csvText = decoder.decode(buffer);
    return d3.csvParse(csvText, row => {
      // 统一清洗所有字段中的特殊字符
      const cleanRow = {};
      Object.entries(row).forEach(([key, value]) => {
        // 特别处理Food Name字段
        if (key === "Food Name") {
          value = value
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '') // 去除非中文字符
            .replace(/'/g, ''); // 特别移除单引号
        }
        cleanRow[key] = value;
      });
      return cleanRow;
    });
  })
  .then(data => {
    // 构建初始数据
    const nodes = [];
    const links = [];

    data.forEach(food => {
      const foodName = food["Food Name"];
      let hasConnection = false; // 标记是否有连接

      nutrientConfigs.forEach(config => {
        const value = +food[config.field];
        if (value > config.threshold) {
          if (!nodes.find(n => n.id === config.name)) {
            nodes.push({
              id: config.name,
              type: "nutrient",
              nutrientType: config.name
            });
          }
          links.push({
            source: foodName,
            target: config.name,
            value: value,
            nutrientType: config.name
          });
          hasConnection = true; // 设置为有连接
        }
      });

      // 如果有连接，添加食物节点
      if (hasConnection) {
        //添加完整营养数据
        nodes.push({
          id: foodName,
          type: "food",
          calories: +food.Calories,
          category: food["Category Name"],
          // 新增以下营养字段
          Fiber: +food.Fiber,
          // VitaminC: +food["Vitamin C"], // 处理带空格的列名
          Calcium: +food.Calcium,
          Carbs: +food.Carbs,
          Fats: +food.Fats,
          Folate: +food.Folate,
          Iron: +food.Iron,
          Protein: +food.Protein,
          Sodium: +food.Sodium
        });
      }
    });

    // 保存原始数据
    originalLinks = links;
    originalNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());

    // 创建力导向图
    simulation = d3.forceSimulation(originalNodes)
      .force("link", d3.forceLink(originalLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("collide", d3.forceCollide().radius(30)) // 防止节点重叠
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX().x(width / 2).strength(0.1)) // 添加X方向的力
      .force("y", d3.forceY().y(height / 2).strength(0.1)) // 添加Y方向的力
      .force("boundaryX", d3.forceX().x(width / 2).strength(0.1).strength(d => d.x < 0 || d.x > width ? 0.5 : 0.1)) // 边界X方向的力
      .force("boundaryY", d3.forceY().y(height / 2).strength(0.1).strength(d => d.y < 0 || d.y > height ? 0.5 : 0.1)) // 边界Y方向的力
      .alphaDecay(0.05);

    // 颜色比例尺
    const nodeColors = d3.scaleOrdinal()
      .domain(["food", ...nutrientConfigs.map(c => c.name)])
      .range(["#66c2a5", ...nutrientConfigs.map(c => c.color)]);

    // 绘制连线（绑定正确数据）
    link = svg.append("g")
      .selectAll("line")
      .data(originalLinks)
      .join("line")
      .attr("class", "link")
      .attr("stroke", d => nutrientConfigs.find(c => c.name === d.nutrientType).color)
      .attr("stroke-width", 2);

    // 绘制节点（绑定正确数据）
    node = svg.append("g")
      .selectAll("circle")
      .data(originalNodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", 8)
      .attr("fill", d => nodeColors(d.type === "food" ? "food" : d.nutrientType))
      .call(drag(simulation));

    // 节点标签
    labels = svg.append("g")
      .selectAll("text")
      .data(originalNodes)
      .join("text")
      .text(d => d.id)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
        .attr("fill", "white");         
        // 使得画的文本内容为白色

    // 力导向图更新
    simulation.on("tick", () => {
      node.each(function (d) {
        d.x = Math.max(30, Math.min(width - 30, d.x));
        d.y = Math.max(30, Math.min(height - 30, d.y));
      });
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // 交互功能
    node.on("mouseover", function (event, d) {
      const currentLinks = simulation.force("link").links();
      let html = `食物：${d.id}<br>热量：${d.calories} kcal <br>类别：${d.category}`;
      if (d.type === "nutrient") {
        const relatedFoods = currentLinks.filter(l => l.target.id === d.id).length;
        html = `营养属性：${d.id}<br>关联食物数量：${relatedFoods}`;
      }
      tooltip
        .html(html)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`)
        .transition().duration(200).style("opacity", 0.9);
    }).on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    }).on("click", function (event, d) {
      if (d.type === "food") {
        fetchFoodInfo(d.id);
      }
    });

    // 创建图例
    const legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 12)
      .attr("transform", `translate(${width - 150},20)`)
      .selectAll("g")
      .data(nutrientConfigs)
      .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`)
         .attr("fill", "white");         
        // 使得画的文本内容为白色;
      

    legend.append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", d => d.color)
      .on("click", d => filterByNutrient(d.name));

    legend.append("text")
      .attr("x", 24)
      .attr("y", 9)
      .attr("dy", "0.32em")
      .text(d => d.name);
  });
originalNodes.forEach(d => {
  // 营养节点初始分布在四周
  if (d.type === "nutrient") {
    const angle = Math.random() * Math.PI * 2;
    d.x = width / 2 + Math.cos(angle) * width * 0.4;
    d.y = height / 2 + Math.sin(angle) * height * 0.4;
  } else {
    // 食物节点随机分布在中心区域
    d.x = width / 2 + (Math.random() - 0.5) * width * 0.3;
    d.y = height / 2 + (Math.random() - 0.5) * height * 0.3;
  }
});
function autoZoom() {
  const nodes = node.nodes();
  const xExtent = d3.extent(nodes, d => d.x);
  const yExtent = d3.extent(nodes, d => d.y);

  // 计算缩放比例时保留20%边距
  const scale = Math.min(
    (width * 0.8) / (xExtent[1] - xExtent[0]),
    (height * 0.8) / (yExtent[1] - yExtent[0])
  ) * 0.9; // 额外缩小10%避免贴边

  const translate = [
    (width - (xExtent[0] + xExtent[1]) * scale) / 2,
    (height - (yExtent[0] + yExtent[1]) * scale) / 2
  ];

  svg.transition()
    .duration(1000)
    .call(zoom.transform, d3.zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale)
    );
}
function filterByNutrient(nutrientName) {
  // 从原始数据重新过滤
  const filteredLinks = originalLinks.filter(d => d.nutrientType === nutrientName);
  const relatedFoodIds = [...new Set(filteredLinks.map(d => d.source.id))];

  // 严格过滤节点：仅包含目标营养素节点 + 直接关联的食物节点
  const filteredNodes = originalNodes.filter(d =>
    (d.type === "nutrient" && d.id === nutrientName) ||
    (d.type === "food" && relatedFoodIds.includes(d.id))
  );

  // 完全替换当前显示数据
  currentNodes = [...filteredNodes];
  currentLinks = [...filteredLinks];

  // 强制重新绘制
  forceUpdateVisuals();
  //第二次筛选    重复调用从而解决bug——天才阿斌
  // 完全替换当前显示数据
  currentNodes = [...filteredNodes];
  currentLinks = [...filteredLinks];

  // 强制重新绘制
  forceUpdateVisuals();
}

// 强制更新函数
function forceUpdateVisuals() {
  // 完全移除旧元素
  svg.selectAll(".link").remove();
  svg.selectAll(".node").remove();
  svg.selectAll("text").remove();

  const legend = svg.append("g")
    .attr("font-family", "sans-serif")
    .attr("font-size", 12)
    .attr("transform", `translate(${width - 150},20)`)
    .selectAll("g")
    .data(nutrientConfigs)
    .join("g")
    .attr("transform", (d, i) => `translate(0,${i * 20})`)
       .attr("fill", "white");         
        // 使得画的文本内容为白色;

  legend.append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", d => d.color)
    .on("click", d => filterByNutrient(d.name));

  legend.append("text")
    .attr("x", 24)
    .attr("y", 9)
    .attr("dy", "0.32em")
    .text(d => d.name);

  // 重新创建比例尺
  const nodeColors = d3.scaleOrdinal()
    .domain(["food", ...nutrientConfigs.map(c => c.name)])
    .range(["#66c2a5", ...nutrientConfigs.map(c => c.color)]);

  // 重新绘制连线
  link = svg.append("g")
    .selectAll("line")
    .data(currentLinks, d => `${d.source.id}-${d.target.id}`) // 唯一标识
    .join("line")
    .attr("class", "link")
    .attr("stroke", d => nutrientConfigs.find(c => c.name === d.nutrientType).color)
    .attr("stroke-width", 2);

  // 节点创建逻辑
  node = svg.append("g")
    .selectAll("circle")
    .data(currentNodes, d => d.id)
    .join("circle")
    .attr("class", d => `node ${d.highlighted ? "recommended" : ""}`) // 添加状态类
    .attr("r", d => d.highlighted ? 12 : 8)
    .call(drag(simulation))
    .attr("fill", d => {
      if (d.highlighted) return "orange";
      return nodeColors(d.type === "food" ? "food" : d.nutrientType);
    })
    // 强制绑定点击事件
    .on("click", function (event, d) {
      if (!window.isDataLoaded) {
        alert("数据加载中，请稍后");
        return;
      }
      if (d.type === "food") {
        const cleanName = d.id
          .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
          .replace(/'/g, '');
        fetchFoodInfo(cleanName); // 使用清洗后的名称
      }
    });

  // 重新绘制标签
  labels = svg.append("g")
    .selectAll("text")
    .data(currentNodes, d => d.id)
    .join("text")
    .text(d => d.id)
    .attr("font-size", 10)
    .attr("dx", 12)
    .attr("dy", 4)
    .attr("fill", "white");         
        // 使得画的文本内容为白色

  // 完全重建力导向图
  simulation = d3.forceSimulation(currentNodes)

    .force("link", d3.forceLink(currentLinks).id(d => d.id).distance(200)) // 增加连接距离
    .force("charge", d3.forceManyBody()
      .strength(d => d.type === "nutrient" ? -1000 : -300) // 差异化斥力
    )
    .force("collide", d3.forceCollide()
      .radius(d => d.type === "nutrient" ? 80 : 35) // 增大碰撞半径
      .strength(0.9)
    )
    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.08)) // 降低中心引力
    .force("boundary", () => { // 新增柔和边界力
      const padding = 80; // 安全边距
      const pushStrength = 0.2; // 边界推力系数

      node.each(d => {
        // X轴边界约束
        if (d.x < padding) d.vx += (padding - d.x) * pushStrength;
        if (d.x > width - padding) d.vx += (width - padding - d.x) * pushStrength;

        // Y轴边界约束
        if (d.y < padding) d.vy += (padding - d.y) * pushStrength;
        if (d.y > height - padding) d.vy += (height - padding - d.y) * pushStrength;
      });
    })
    .alphaDecay(0.02) // 更慢的能量衰减
    .velocityDecay(0.25) // 适当的速度衰减
  // 重新绑定位置更新
  simulation.on("tick", () => {

    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  });

  // 重新绑定交互事件copy就行了
  node.on("mouseover", function (event, d) {
    const currentLinks = simulation.force("link").links();
    let html = `食物：${d.id}<br>热量：${d.calories} kcal <br>类别：${d.category}`;
    if (d.type === "nutrient") {
      const relatedFoods = currentLinks.filter(l => l.target.id === d.id).length;
      html = `营养属性：${d.id}<br>关联食物数量：${relatedFoods}`;
    }
    tooltip
      .html(html)
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 28}px`)
      .transition().duration(200).style("opacity", 0.9);
  })
    .on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    })
    .on("click", function (event, d) {
      if (d.type === "food") {
        fetchFoodInfo(d.id);
      }
    });

  // setTimeout(() => {
  //   autoZoom();
  //   simulation.alpha(1).restart();
  // }, 1000);
}

// 重置函数
function resetFilter() {
  // 第一次调用
  currentNodes = [...originalNodes];
  currentLinks = [...originalLinks];
  forceUpdateVisuals();

  // 第二次调用
  currentNodes = [...originalNodes];
  currentLinks = [...originalLinks];
  forceUpdateVisuals();
}

// 拖拽功能
function drag(simulation) {
  return d3.drag()
    .on("start", event => {
      if (!event.active) simulation.alphaTarget(0.1).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on("drag", event => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on("end", event => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });
}

// 从本地JSON文件中加载食物信息
async function loadFoodInfo() {
  try {
    // 加载CSV数据
    const responseCsv = await fetch('./foodstruct_nutritional_facts.csv');
    if (!responseCsv.ok) {
      throw new Error('Network response for CSV was not ok');
    }
    const buffer = await responseCsv.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    const csvText = decoder.decode(buffer);
    const rows = csvText.split('\n').map(row => row.split(','));

    
    const headers = rows[0];
    foodInfoMap = new Map();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const foodName = row[headers.indexOf('Food Name')]
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '') // 去除非中文字符
        .replace(/'/g, '');

      const calories = row[headers.indexOf('Calories')];
      const protein = row[headers.indexOf('Protein')];
      const fats = row[headers.indexOf('Fats')];
      const carbs = row[headers.indexOf('Carbs')];
      const sodium = row[headers.indexOf('Sodium')];

      foodInfoMap.set(foodName, {
        name: foodName,
        calories: calories,
        protein: protein,
        fats: fats,
        carbs: carbs,
        sodium: sodium
      });
    }

    // 加载JSON数据
    const responseJson = await fetch('./output.json');
    if (!responseJson.ok) {
      throw new Error('Network response for JSON was not ok');
    }
    const dataJson = await responseJson.json();

    dataJson.forEach(food => {
      const foodName = food.name;
      if (foodInfoMap.has(foodName)) {
        // 合并数据
        foodInfoMap.set(foodName, {
          ...foodInfoMap.get(foodName),
          image: food.image,
          description: food.description
        });
      } else {
        // 如果CSV中没有该食物，则直接添加
        foodInfoMap.set(foodName, food);
      }
    }); isDataLoaded = true;
    return true;
  } catch (error) {
    isDataLoaded = false;
    // console.error('There was a problem with the fetch operation:', error);
    return false;
  }

}


async function fetchFoodInfo(rawName) {
  // 统一清洗规则
  const cleanName = rawName
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .replace(/'/g, '');

  console.log('当前查询名称：', cleanName);
  console.log('现有数据Key：', Array.from(foodInfoMap.keys()));

  const info = foodInfoMap.get(cleanName);
  if (info) {
    displayFoodInfo(info);
  } else {
    console.error('未找到匹配数据，请检查名称：', cleanName);
    alert("暂未收录该食物的详细信息");
  }
}

// 新增函数：显示食物信息
function displayFoodInfo(data) {
  const foodInfoDiv = document.getElementById('food-info');
  foodInfoDiv.innerHTML = `
      <h3 class="food-info">  ${data.name}</h3>
      <img class="food-info" src="${data.image}" alt="${data.name}" style="width: 80%; height: 20%;">
      <p class="food-info">  ${data.description}</p>
      <p class="food-info"><strong>热量:</strong> ${data.calories} kcal/100g</p>
      <p class="food-info"><strong>  蛋白质:</strong> ${data.protein} g/100g</p>
      <p class="food-info"><strong>  脂肪:</strong> ${data.fats} g/100g</p>
      <p class="food-info"><strong>  碳水化合物:</strong> ${data.carbs} g/100g</p>
      <p class="food-info"><strong>  钠:</strong> ${data.sodium} g/100g</p>
      <p>*注：总质量含未列出的水分及其他微量成分。*</p>
    `;
}

let foodInfoMap = new Map();

// 加载食物信息
loadFoodInfo().then(() => {
  if (document.getElementById('stats-container').classList.contains('active')) {
    initCharts();
  }
});

const qaPairs = {
  "哪些水果富含维生素C？": "富含维生素C的水果包括：西印度樱桃、番石榴、猕猴桃、草莓、柑橘类水果（如橙子、柠檬）等。维生素C有助于增强免疫力。",
  "高纤维食物有哪些推荐？": "高纤维食物推荐：牛油果、树莓、黑莓、梨、苹果（带皮）、香蕉等。膳食纤维有助于促进肠道健康。",
  "低热量水果有哪些选择？": "低热量选择：西瓜（30kcal/100g）、草莓（32kcal）、哈密瓜（34kcal）、木瓜（43kcal）等，适合控制热量摄入。"
};

// 显示问题列表
function showQuestionList() {
  const list = document.getElementById("question-list");
  list.style.display = "block";

  // 清空旧列表
  list.innerHTML = "";

  // 动态生成问题选项
  Object.keys(qaPairs).forEach(question => {
    const div = document.createElement("div");
    div.textContent = question;
    div.onclick = () => selectQuestion(question);
    list.appendChild(div);
  });
}

function displayAnswer(question, answer) {
  const answerBox = document.getElementById("answer-box");
  answerBox.innerHTML = `
      <div class="answer-header">
        <div class="question-mark">?</div>
        <div class="question-text">${question}</div>
      </div>
      <div class="answer-content">
        ${answer}
      </div>
    `;

  // 自动滚动到顶部
  answerBox.scrollTo(0, 0);
}

// 选择问题
function selectQuestion(question) {
  document.getElementById("question-input").value = question;
  document.getElementById("question-list").style.display = "none";
}

// 提交查询
function submitQuestion() {
  const question = document.getElementById("question-input").value;
  const matchedNutrients = analyzeQuestion(question);

  if (matchedNutrients.length > 0) {
    const answer = generateSmartAnswer(matchedNutrients);
    displayAnswer(question, answer);
    highlightRelatedNodes(matchedNutrients);
  } else {
    const answer = qaPairs[question] || "暂未收录该问题的答案";
    displayAnswer(question, answer);
  }
}
function analyzeQuestion(question) {
  const matched = [];

  // 关键词匹配
  Object.entries(keywordMapping).forEach(([keywords, nutrients]) => {
    const regex = new RegExp(keywords.split('|').join('|'), 'i');
    if (regex.test(question)) {
      matched.push(...nutrients.split('|'));
    }
  });

  // 去重并过滤有效营养素
  return [...new Set(matched)]
    .map(n => nutrientConfigs.find(c => c.name === n))
    .filter(Boolean);
}

function generateSmartAnswer(nutrients) {
  // 情境判断
  const hasSpecialGroup = checkSpecialGroup(nutrients);
  const isCombined = nutrients.length > 1;

  // 生成自然语言段落
  let paragraphs = [];

  if (isCombined) {
    paragraphs.push(answerTemplates.combined(nutrients.map(n => ({
      displayName: n.name.replace('高', ''),
      exampleFoods: getTopFoods(n, 2).map(f => f.id).join('、')
    }))));
  }

  nutrients.forEach(config => {
    const foods = getTopFoods(config, 3);
    const foodDesc = foods.map(f =>
      `<span class="food-link" onclick="handleRecommendClick('${f.id}')">${f.id}</span>`
    ).join('、');

    paragraphs.push(
      `
        ${getRecommendReason(config.name)}。
        ${config.name}类食物的优质选择包括${foodDesc}。${getBenefit(config.name)}，${config.inverse ? '每日摄入建议控制在' : '推荐每日摄入量约为'
      }${getIntakeRecommendation(config)}。`
    );
  });
  // 添加健康小贴士
  paragraphs.push(`<div class="health-tip">💡 小贴士：${generateCookingTip(nutrients)}</div>`);

  return paragraphs.join('\n\n');
}

function handleRecommendClick(foodName) {
  const cleanName = foodName
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .replace(/'/g, '');
  fetchFoodInfo(cleanName);

  // 触发对应节点动画
  d3.selectAll('.node')
    .filter(d => d.id === foodName)
    .classed("highlight-pulse", true)
    .transition()
    .duration(1000)
    .attr("r", 14)
    .transition()
    .attr("r", 12)
    .on("end", () => d3.selectAll('.node').classed("highlight-pulse", false));
}

function getTopFoods(config, limit = 5) { // 改为默认取前5名
  return originalNodes
    .filter(node => node.type === 'food')
    .filter(food => {
      const value = food[config.field];
      return config.inverse
        ? value < config.threshold
        : value > config.threshold;
    })
    .sort((a, b) => {
      return config.inverse
        ? a[config.field] - b[config.field]  // 低热量升序排列
        : b[config.field] - a[config.field]; // 其他降序排列
    })
    .slice(0, limit);
}


function getRecommendReason(nutrient) {
  const reasons = {
    '高钙': '钙质是骨骼健康的基础，充足的钙摄入有助于预防骨质疏松症',
    '高纤维': '膳食纤维能促进肠道蠕动，帮助维持消化系统健康',
    '高铁': '铁元素是造血的重要原料，充足的铁摄入有助于预防贫血',
    '高蛋白': '蛋白质是肌肉合成的重要营养素，健身人群需要更多摄入',
    '低热量': '低热量食物有助于控制总能量摄入，适合体重管理期间食用',
    '高维生素C': '维生素C能增强免疫力，促进铁的吸收利用'
  };
  return reasons[nutrient] || '该营养素对维持身体正常机能具有重要作用';
}

function highlightRelatedNodes(nutrients) {
  // 获取所有食物节点
  const foodNodes = originalNodes.filter(node => node.type === 'food');

  // 获取推荐食物节点
  const recommendedFoods = nutrients.flatMap(config => getTopFoods(config, 3));

  // 高亮推荐食物节点
  recommendedFoods.forEach(food => {
    const node = foodNodes.find(n => n.id === food.id);
    if (node) {
      node.highlighted = true;
    }
  });

  // 修改高亮节点的事件绑定
  node.filter(d => d.highlighted)
    .attr("r", 12)
    .attr("fill", "orange")
    .on("click", function (event, d) {
      if (!isDataLoaded) return;
      // 使用与主图一致的清洗规则
      const cleanName = d.id
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
        .replace(/'/g, '');
      fetchFoodInfo(cleanName);
      // 保持其他节点的可点击性
      d3.select(this).attr("fill", "orange");
      event.stopPropagation(); // 阻止事件冒泡
    });

  // 添加持久化高亮状态
  node.classed("recommended", d => d.highlighted);

  // 重新绑定交互事件
  node.on("mouseover", function (event, d) {
    const currentLinks = simulation.force("link").links();
    let html = `食物：${d.id}<br>热量：${d.calories} kcal`;
    if (d.type === "nutrient") {
      const relatedFoods = currentLinks.filter(l => l.target.id === d.id).length;
      html = `营养属性：${d.id}<br>关联食物数量：${relatedFoods}`;
    }
    tooltip
      .html(html)
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 28}px`)
      .transition().duration(200).style("opacity", 0.9);
  })
    .on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    })
    .on("click", function (event, d) {
      if (d.type === "food") {
        fetchFoodInfo(d.id);
      }
    });
}

// 点击页面其他区域关闭列表
document.addEventListener("click", function (e) {
  if (!e.target.closest("#question-input, #question-list")) {
    document.getElementById("question-list").style.display = "none";
  }
});


function switchTab(tabName) {
  // 切换按钮状态
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 切换内容显示
  const containers = document.querySelectorAll('.content-pane');
  containers.forEach(container => {
    const isTarget = container.id === `${tabName}-container`;
    container.classList.toggle('active', isTarget);
    
    // 增加过渡动画支持
    if (isTarget) {
      setTimeout(() => {
        container.style.opacity = 1;
        container.style.transform = 'translateY(0)';
        
        // 统计页的特殊处理
        if (tabName === 'stats') {
          if (foodInfoMap.size > 0) {
            initCharts();
          } else {
            loadFoodInfo().then(initCharts);
          }
        }
      }, 10);
    } else {
      container.style.opacity = 0;
      container.style.transform = 'translateY(20px)';
    }
  });

  const queryModule = document.getElementById('query-module');
  const answerBox = document.getElementById('answer-box');
  
  if (tabName === 'graph') {
    // 显示查询模块
    queryModule.style.opacity = 1;
    queryModule.style.pointerEvents = 'auto';
    queryModule.style.transform = 'translateX(0)';
  } else {
    // 隐藏查询模块并重置状态
    queryModule.style.opacity = 0;
    queryModule.style.pointerEvents = 'none';
    queryModule.style.transform = 'translateX(-20px)';
    answerBox.innerHTML = '';  // 清空答案
    document.getElementById('question-list').style.display = 'none';  // 关闭问题列表
  }

  const controlElements = [
    { element: document.getElementById('query-module'), showIn: 'graph' },
    { element: document.getElementById('food-info'), showIn: 'graph' }
  ];

  controlElements.forEach(({ element, showIn }) => {
    if (element) {
      const shouldShow = tabName === showIn;
      element.style.opacity = shouldShow ? 1 : 0;
      element.style.pointerEvents = shouldShow ? 'auto' : 'none';
      element.style.transform = shouldShow ? 'translateX(0)' : 'translateX(-20px)';
      
      // 清空食物信息内容（可选）
      if (!shouldShow && element.id === 'food-info') {
        element.innerHTML = '';
      }
    }
  });


}




function handleClick() {
  switchTab('graph');
  resetFilter();
}


// 在script.js中添加关键词-营养素映射
const keywordMapping = {
  '老年|年纪大|中老年|骨质疏松': '高钙',
  '便秘|肠胃不好|消化不好': '高纤维',
  '贫血|头晕|乏力': '高铁',
  '健身|增肌|锻炼': '高蛋白',
  '减肥|瘦身|低卡': '低热量',
  '免疫力|感冒': '高维生素C',
  '孕妇|孕期|哺乳期': '高叶酸',
  '高血压|水肿': '低钠',
  '儿童|发育': '高钙|高蛋白'
};


const answerTemplates = {
  default: (nutrient, foods) =>
    `针对${nutrient}需求，建议您多食用${foods.slice(0, 3).join('、')}等食物。这类食物不仅${getBenefit(nutrient)}，日常适量食用还能${getAdditionalTip(nutrient)}。`,

  combined: (nutrients) =>
    `综合您的情况，需要特别关注下列食物的摄入。建议在日常饮食中：\n${nutrients.map(n => `• 通过${n.exampleFoods}等食物补充${n.displayName}`).join('\n')
    }`,

  specialGroup: (group, nutrient) =>
    `${group}群体对${nutrient.displayName}的需求较高，推荐选择${nutrient.exampleFoods}。这类食物在提供必要营养的同时，还能${getSpecialBenefit(group)}。`
};

// 营养益处映射
const nutrientBenefits = {
  '高纤维': '促进肠道蠕动，改善便秘问题',
  '高钙': '强化骨骼健康，预防骨质疏松',
  '高铁': '提高血红蛋白水平，预防贫血',
  '低热量': '控制热量摄入，辅助体重管理',
  // 其他营养类型...
};

// 获取动态建议
function getBenefit(nutrient) {
  return nutrientBenefits[nutrient] || '提供必要的营养支持';
}
// 智能摄入建议
function getIntakeRecommendation(config) {
  const recommendations = {
    '高纤维': '25-30g',
    '高钙': '800-1000mg',
    '低热量': '不超过200kcal/餐',
    '高铁': '男性12mg/日，女性20mg/日',
    // 其他营养类型...
  };
  return recommendations[config.name] || '根据个人情况适量摄入';
}

// 烹饪建议生成
// 根据传入的营养成分，生成烹饪建议
function generateCookingTip(nutrients) {
  // 定义不同营养成分的组合和对应的烹饪建议
  const combinations = {
    '高纤维+高钙': '将菠菜与豆腐搭配食用，钙吸收率可提升30%',
    '低热量+高蛋白': '鸡胸肉沙拉搭配柠檬汁，既低卡又促进蛋白质吸收',
    '高铁+维生素C': '牛肉炒彩椒，维生素C帮助铁质吸收',
    // '高纤维+高钙': '老八蜜汁小汉堡，又实惠，又管饱',
    '高钙+高蛋白质': '鸡胸肉沙拉搭配柠檬汁，既高钙又促进蛋白质吸收',
    '高钙+高纤维': '菠菜与豆腐搭配食用，钙吸收率可提升30%',
    // 更多组合建议...
  };

  // 将传入的营养成分按照名称排序，并拼接成字符串
  const nutrientKeys = nutrients.map(n => n.name).sort().join('+');
  return combinations[nutrientKeys] || '注意食物多样化搭配，保证营养均衡';
}
// 特殊人群检测
function checkSpecialGroup(nutrients) {
  const groupKeywords = {
    '孕妇': ['叶酸', '铁'],
    '老年人': ['钙', '纤维'],
    '婴幼儿': ['DHA', '锌']
  };

  return Object.entries(groupKeywords).find(([group, needs]) =>
    needs.some(need => nutrients.some(n => n.name.includes(need)))
  );
}

// 根据检测结果优化回答
if (hasSpecialGroup) {
  paragraphs.unshift(
    `作为${hasSpecialGroup}群体，需要特别注意${hasSpecialGroup.join('和')}的摄入：`
  );
}






    
