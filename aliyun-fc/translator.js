// 跨境电商专用翻译引擎（离线 + 在线混合）
const DICT = {
  // 电子产品
  "蓝牙": "Bluetooth", "音箱": "Speaker", "耳机": "Earphones", "充电器": "Charger", "数据线": "Cable", "移动电源": "Power Bank",
  "手机壳": "Phone Case", "屏幕": "Screen", "键盘": "Keyboard", "鼠标": "Mouse", "摄像头": "Camera", "智能手表": "Smart Watch",
  // 家居
  "地毯": "Rug", "窗帘": "Curtains", "台灯": "Desk Lamp", "收纳盒": "Storage Box", "衣柜": "Wardrobe", "抱枕": "Throw Pillow",
  "床单": "Bed Sheet", "毛巾": "Towel", "浴帘": "Shower Curtain", "挂钩": "Hook", "置物架": "Shelf",
  // 服装
  "T恤": "T-Shirt", "连衣裙": "Dress", "外套": "Jacket", "牛仔裤": "Jeans", "运动鞋": "Sneakers", "帽子": "Hat",
  "袜子": "Socks", "围巾": "Scarf", "手套": "Gloves", "背包": "Backpack", "拖鞋": "Slippers", "睡衣": "Pajamas",
  // 美妆
  "口红": "Lipstick", "眼影": "Eyeshadow", "面膜": "Face Mask", "精华": "Serum", "防晒": "Sunscreen", "香水": "Perfume",
  "爽肤水": "Toner", "面霜": "Moisturizer", "粉底": "Foundation", "眉笔": "Eyebrow Pencil", "卸妆": "Makeup Remover",
  // 运动
  "瑜伽垫": "Yoga Mat", "哑铃": "Dumbbell", "跳绳": "Jump Rope", "护膝": "Knee Brace", "泳镜": "Swimming Goggles",
  // 通用属性
  "便携式": "Portable", "防水": "Waterproof", "便携": "Portable", "无线": "Wireless", "充电": "Rechargeable", "折叠": "Foldable",
  "防滑": "Anti-Slip", "透气": "Breathable", "环保": "Eco-Friendly", "静音": "Silent", "迷你": "Mini",
  "大容量": "Large Capacity", "快充": "Fast Charging", "高清": "HD", "智能": "Smart", "自动": "Automatic",
  "耐用": "Durable", "轻便": "Lightweight", "多功能": "Multi-Function", "USB": "USB", "LED": "LED",
  // 颜色
  "黑色": "Black", "白色": "White", "红色": "Red", "蓝色": "Blue", "绿色": "Green", "粉色": "Pink",
  "灰色": "Gray", "紫色": "Purple", "黄色": "Yellow", "橙色": "Orange", "棕色": "Brown", "金色": "Gold",
  // 尺寸
  "厘米": "cm", "毫米": "mm", "英寸": "inch", "米": "m", "克": "g", "千克": "kg",
  // 电商术语
  "包邮": "Free Shipping", "现货": "In Stock", "批发": "Wholesale", "定制": "Custom", "正品": "Genuine",
  "材质": "Material", "尺寸": "Size", "重量": "Weight", "颜色": "Color", "款式": "Style",
};

function translateText(text, from, to) {
  if (!text) return "";
  var isEnToCn = from === "en" && to === "zh";
  var isCnToEn = from === "zh" && to === "en";

  if (!isEnToCn && !isCnToEn) return text;

  var result = text;
  if (isCnToEn) {
    // 中文→英文：先用词典逐词替换
    var sorted = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < sorted.length; i++) {
      var cn = sorted[i];
      if (result.includes(cn)) result = result.split(cn).join(" " + DICT[cn] + " ");
    }
    // 清理多余空格
    result = result.replace(/\s+/g, " ").trim();
  } else {
    // 英文→中文：反向词典
    var rev = {};
    for (var k in DICT) rev[DICT[k]] = k;
    var sortedEn = Object.keys(rev).sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < sortedEn.length; j++) {
      var en = sortedEn[j];
      if (result.toLowerCase().includes(en.toLowerCase())) {
        var re = new RegExp(en, "gi");
        result = result.replace(re, rev[en]);
      }
    }
  }

  return result;
}

module.exports = { translateText };
