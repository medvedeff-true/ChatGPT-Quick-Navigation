## [Русский](#русский) | [English](#english)

---

## Русский

# ChatGPT Quick Navigation

> Я устал крутить колёсико как бешеный чтобы найти нужный мне старый вопрос в чате, но OpenAi почему-то не хотят добавлять эту фичу официально, поэтому от безысходности я сам доработал интерфейс ChatGPT, чтобы можно было комфортнее перемещаться по чату.

**ChatGPT Quick Navigation** — это минималистичное расширение для браузера, которое добавляет удобную навигацию по вопросам пользователя в текущем чате на `chatgpt.com`.

Расширение автоматически создаёт компактную панель с маркерами всех ваших вопросов и позволяет мгновенно перемещаться по диалогу без бесконечного скролла.

---

## 🖼 Интерфейс

<img width="59" height="301" alt="image" src="https://github.com/user-attachments/assets/f03bd025-f874-49cc-aa0f-c7257cba7476" />
👈Слайдер
<img width="352" height="366" alt="image" src="https://github.com/user-attachments/assets/ceb2bf55-23fb-446e-a434-42da4fc1f062" />
👈Развёрнутый
<img width="465" height="356" alt="image" src="https://github.com/user-attachments/assets/ea7da5f4-bded-4476-98ef-3e4cbeac3add" />
👈Подробное описание вопроса

---

## 🧩 Возможности

- 📍 Автоматическое определение всех вопросов пользователя в чате
- 🧭 Быстрая навигация по вопросам одним кликом
- 🔵 Живая подсветка текущего вопроса при прокрутке страницы
- 📌 Активный маркер всегда синхронизирован с положением в чате
- 🪄 Автоматическая прокрутка списка навигации при выходе за пределы видимой области
- 📝 Показ полного текста вопроса при удержании курсора
- 🌗 Поддержка светлой и тёмной темы
- ⚡ Работа без лишних кнопок и перегруженного интерфейса
- 🧠 Корректная работа даже в больших чатах с файлами и изображениями

---

## 🚀 Как это работает

После установки расширение:

1. Анализирует текущий чат
2. Находит все сообщения пользователя
3. Строит компактный вертикальный список маркеров
4. Синхронизирует активный вопрос с текущим положением страницы
5. Позволяет быстро прыгать к любому месту диалога

---

## 📦 Установка (пока вручную)

Расширение пока не опубликовано в Chrome Web Store, поэтому установка выполняется вручную.

### 🔧 Шаги установки:

1. Скачайте или клонируйте репозиторий:
   ```
   git clone https://github.com/medvedeff-true/chatgpt-quick-navigation.git
   ```

2. Откройте в Chrome:
   ```
   chrome://extensions
   ```

3. Включите **Режим разработчика** (справа сверху)

4. Нажмите **Загрузить распакованное расширение**

5. Выберите папку проекта

6. Готово ✅

После этого расширение автоматически начнёт работать на `https://chatgpt.com`

---

## 📁 Структура проекта

```
chatgpt-nav-extension/
│
├── manifest.json
├── content.js
├── styles.css
└── icons/
    ├── 16x16.png
    ├── 24x24.png
    ├── 32x32.png
    ├── 48x48.png
    └── 128x128.png
```

---

## 🛠 Технические детали

- Manifest Version: 3
- Работает только на `chatgpt.com`
- Не отправляет данные никуда
- Не использует сторонние API
- Не хранит данные пользователя
- Полностью работает локально в браузере

---

## 🔒 Безопасность и приватность

Расширение:
- ❌ Не собирает данные
- ❌ Не передаёт информацию третьим лицам
- ❌ Не вмешивается в работу аккаунта
- ✅ Работает исключительно с DOM текущей страницы

Код полностью открыт — вы можете проверить его самостоятельно.

---

<br><br><br>

---

## English

# ChatGPT Quick Navigation

> I got tired of scrolling like crazy trying to find an old question in long ChatGPT conversations. Since OpenAI doesn’t seem to be adding this feature officially, I decided to extend the interface myself to make navigation more comfortable.

**ChatGPT Quick Navigation** is a lightweight browser extension that adds fast question-based navigation inside ChatGPT conversations on `chatgpt.com`.

It automatically builds a compact navigation sidebar showing all your questions and keeps it synchronized with your current scroll position.

---

## 🖼 Interface

<img width="59" height="301" alt="image" src="https://github.com/user-attachments/assets/f03bd025-f874-49cc-aa0f-c7257cba7476" />
👈Slider
<img width="352" height="366" alt="image" src="https://github.com/user-attachments/assets/ceb2bf55-23fb-446e-a434-42da4fc1f062" />
👈Open hover
<img width="465" height="356" alt="image" src="https://github.com/user-attachments/assets/ea7da5f4-bded-4476-98ef-3e4cbeac3add" />
👈Descriptions of selected questions

---

## 🧩 Features

- 📍 Automatically detects all user messages
- 🧭 One-click navigation to any question
- 🔵 Live highlight of the currently visible question
- 📌 Scroll-synced active marker
- 🪄 Auto-scroll of navigation list when needed
- 📝 Full question tooltip on hover
- 🌗 Dark and light theme support
- ⚡ Minimal and non-intrusive UI
- 🧠 Works correctly in large chats (including images/files)

---

## 📦 Installation (Manual)

The extension is not yet published to Chrome Web Store.

### Steps:

1. Clone or download the repository
2. Open:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

Done ✅

The extension will now work on `https://chatgpt.com`.

---

## 🛠 Technical Info

- Manifest v3
- Works only on chatgpt.com
- No tracking
- No external API calls
- No data storage
- 100% client-side

---

## 🔒 Privacy

This extension:
- Does NOT collect any user data
- Does NOT send anything to external servers
- Works entirely inside the browser

Open source and transparent.

---

