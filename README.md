# 📜 Vertical Text Image Generator（竖排文字截图生成器）

**版本：正式版 / Stable Release**

一个能将竖排文字 DOM 精确转换为 PNG 图片的网页工具，  
可完美保留竖排布局的行距、列距、字体、边框、背景样式等。

---

## ✨ 功能亮点
- ✅ 支持 `writing-mode: vertical-rl` 的竖排文字
- ✅ 精准还原原 DOM 的行距 (`line-height`) 与列距 (`letter-spacing`)
- ✅ 保留边框 (`border`) 与内边距 (`padding`)
- ✅ 一键生成高分辨率图片（2x scale）
- ✅ 一键下载 PNG 文件

---

## 🧩 使用方式

1. 直接打开 `index.html`
2. 在文本区域中输入你想要的竖排文字
3. 点击「生成图片」
4. 下载结果 PNG

---

## 💡 技术说明

- 使用 [html2canvas](https://html2canvas.hertzen.com/) 进行 DOM → Canvas 渲染
- 使用 CSS `writing-mode: vertical-rl` 生成竖排排版
- 行距与列距锁定：
  ```css
  line-height: 1.07;
  letter-spacing: 0.5em;
