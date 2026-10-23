# Лендинг «Точки роста: Digital Meetup»

Статика: index.html, assets/ (style.css, main.js, логотипы SVG), privacy.html.
Обработчик формы: send.php (PHP 7.4+, функция mail()).

## Запуск
Залить папку на хостинг с PHP. Форма шлёт POST в send.php, тот:
- валидирует данные (+ honeypot от ботов);
- отправляет участнику письмо-подтверждение с деталями;
- отправляет уведомление организаторам ($CONFIG['organizers']);
- дублирует заявку в registrations/registrations.csv (закрыт .htaccess).

При открытии index.html локально (file://) форма работает в демо-режиме — сразу показывает окно «Спасибо».

## Что нужно заменить
- Логотип Hybrid: сейчас текстовая заглушка .logo-hybrid (header и footer).
- Точный адрес площадки: hero, контакты, send.php → event_place.
- Текст политики конфиденциальности в privacy.html.
- Для доставляемости писем: SPF/DKIM для домена отправителя или SMTP (PHPMailer).
- Метрика: задать window.YM_ID и подключить счётчик — цель registration уже отправляется.
