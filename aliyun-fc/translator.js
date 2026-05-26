// 跨境电商专用翻译引擎（离线 + 在线混合）
const DICT = {
  // ===== 电子产品（Amazon真实用语）=====
  "蓝牙音箱": "Bluetooth Speaker", "便携音箱": "Portable Speaker", "蓝牙耳机": "Wireless Earbuds",
  "充电宝": "Power Bank", "移动电源": "Portable Charger", "数据线": "Charging Cable", "充电线": "USB Cable",
  "快充线": "Fast Charging Cable", "手机壳": "Phone Case", "手机套": "Protective Case",
  "钢化膜": "Screen Protector", "屏幕保护膜": "Tempered Glass Screen Protector",
  "无线充电器": "Wireless Charger", "车载充电器": "Car Charger", "充电头": "Wall Charger",
  "智能手表": "Smartwatch", "运动手表": "Fitness Watch", "智能手环": "Fitness Tracker",
  "蓝牙": "Bluetooth", "音箱": "Speaker", "耳机": "Headphones", "耳塞": "Earbuds",
  "充电器": "Charger", "键盘": "Keyboard", "鼠标": "Mouse", "摄像头": "Webcam",
  "USB集线器": "USB Hub", "读卡器": "Card Reader", "自拍杆": "Selfie Stick", "三脚架": "Tripod",
  "手机支架": "Phone Stand", "车载支架": "Car Mount", "麦克风": "Microphone", "声卡": "Audio Interface",

  // ===== 家居（Amazon真实用语）=====
  "台灯": "Desk Lamp", "落地灯": "Floor Lamp", "夜灯": "Night Light", "LED灯带": "LED Strip Lights",
  "收纳盒": "Storage Organizer", "收纳箱": "Storage Bin", "收纳架": "Storage Rack",
  "置物架": "Wall Shelf", "鞋架": "Shoe Rack", "衣架": "Hangers",
  "地毯": "Area Rug", "门垫": "Door Mat", "浴帘": "Shower Curtain", "浴垫": "Bath Mat",
  "毛巾": "Bath Towel", "床单": "Bed Sheets", "枕套": "Pillowcase", "被套": "Duvet Cover",
  "抱枕": "Throw Pillow", "靠垫": "Cushion", "窗帘": "Curtains", "百叶窗": "Blinds",
  "挂钩": "Adhesive Hooks", "粘钩": "Wall Hooks", "挂钟": "Wall Clock",
  "香薰机": "Aromatherapy Diffuser", "加湿器": "Humidifier", "净化器": "Air Purifier",
  "垃圾桶": "Trash Can", "脏衣篮": "Laundry Basket",

  // ===== 服装（Amazon真实用语）=====
  "T恤": "T-Shirt", "Polo衫": "Polo Shirt", "衬衫": "Dress Shirt", "卫衣": "Hoodie",
  "连衣裙": "Dress", "半身裙": "Skirt", "牛仔裤": "Jeans", "休闲裤": "Casual Pants",
  "运动裤": "Sweatpants", "短裤": "Shorts", "外套": "Jacket", "夹克": "Outerwear",
  "羽绒服": "Down Jacket", "冲锋衣": "Rain Jacket", "运动鞋": "Sneakers", "跑鞋": "Running Shoes",
  "拖鞋": "Slippers", "凉鞋": "Sandals", "袜子": "Socks", "内裤": "Underwear",
  "文胸": "Bra", "帽子": "Cap", "围巾": "Scarf", "手套": "Gloves",
  "背包": "Backpack", "斜挎包": "Crossbody Bag", "钱包": "Wallet", "行李箱": "Luggage",
  "腰带": "Belt", "领带": "Tie",

  // ===== 美妆（Amazon真实用语）=====
  "爽肤水": "Facial Toner", "面霜": "Face Cream", "眼霜": "Eye Cream",
  "精华": "Face Serum", "面膜": "Sheet Mask", "防晒": "Sunscreen",
  "口红": "Lipstick", "唇膏": "Lip Balm", "眼影": "Eyeshadow Palette",
  "粉底": "Foundation", "遮瑕": "Concealer", "散粉": "Setting Powder",
  "眉笔": "Eyebrow Pencil", "眼线笔": "Eyeliner", "睫毛膏": "Mascara",
  "腮红": "Blush", "高光": "Highlighter", "卸妆水": "Micellar Water",
  "卸妆油": "Cleansing Oil", "洗面奶": "Face Wash", "香水": "Perfume",
  "指甲油": "Nail Polish", "美甲灯": "UV Nail Lamp",

  // ===== 运动户外 =====
  "瑜伽垫": "Yoga Mat", "哑铃": "Dumbbell Set", "跳绳": "Jump Rope",
  "拉力带": "Resistance Bands", "护膝": "Knee Sleeve", "护腕": "Wrist Brace",
  "健身手套": "Gym Gloves", "运动水壶": "Sports Water Bottle", "泳镜": "Swim Goggles",
  "帐篷": "Tent", "睡袋": "Sleeping Bag", "野餐垫": "Picnic Blanket",
  "登山杖": "Trekking Poles", "头灯": "Headlamp",

  // ===== 通用属性（Amazon Listing高频词）=====
  "便携式": "Portable", "便携": "Portable", "迷你": "Mini",
  "防水": "Waterproof", "防泼水": "Water Resistant", "防尘": "Dustproof",
  "防滑": "Non-Slip", "防摔": "Shockproof", "防震": "Shock-Absorbing",
  "无线": "Wireless", "蓝牙": "Bluetooth", "充电": "Rechargeable",
  "快充": "Fast Charging", "USB-C": "USB-C", "Type-C": "USB Type C",
  "折叠": "Foldable", "可折叠": "Collapsible", "可拆卸": "Detachable",
  "静音": "Silent", "低噪音": "Low Noise", "透气": "Breathable",
  "环保": "Eco-Friendly", "可回收": "Recyclable", "不锈钢": "Stainless Steel",
  "硅胶": "Silicone", "竹制": "Bamboo", "木制": "Wooden",
  "大容量": "Large Capacity", "超大": "Extra Large", "加大": "Oversized",
  "高清": "HD", "4K": "4K", "1080P": "1080P",
  "智能": "Smart", "自动": "Automatic", "多功能": "Multi-Functional",
  "耐用": "Durable", "轻便": "Lightweight", "紧凑": "Compact",
  "LED": "LED", "USB供电": "USB Powered", "电池供电": "Battery Operated",
  "充电式": "Cordless", "插电式": "Electric",

  // ===== 颜色 =====
  "黑色": "Black", "白色": "White", "红色": "Red", "蓝色": "Blue",
  "绿色": "Green", "粉色": "Pink", "灰色": "Gray", "紫色": "Purple",
  "黄色": "Yellow", "橙色": "Orange", "棕色": "Brown", "金色": "Gold",
  "银色": "Silver", "玫瑰金": "Rose Gold",

  // ===== 电商Listing专用语 =====
  "套装": "Set", "组合": "Combo", "礼盒": "Gift Box", "散装": "Bulk",
  "包邮": "Free Shipping", "现货": "In Stock", "批发": "Wholesale",
  "定制": "Customized", "正品": "Authentic", "原装": "Original",
  "升级版": "Upgraded", "新款": "New", "经典款": "Classic",
  "材质": "Material", "尺寸": "Dimensions", "重量": "Weight", "颜色": "Color",
  "厘米": "cm", "毫米": "mm", "英寸": "inch", "克": "g", "千克": "kg",
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
