<?php
/**
 * Обработчик формы регистрации «Точки роста: Digital Meetup»
 * - валидация данных
 * - письмо-подтверждение участнику
 * - уведомление организаторам
 * - резервная запись заявки в CSV (registrations/registrations.csv)
 *
 * Требуется PHP 7.4+ и настроенная функция mail() на хостинге.
 * Для лучшей доставляемости рекомендуется SMTP (PHPMailer) + SPF/DKIM для домена отправителя.
 */

// ================== НАСТРОЙКИ ==================
$CONFIG = [
    'organizers'  => ['welcome@digitali.ru'],          // кому слать уведомления (можно несколько)
    'from_email'  => 'welcome@digitali.ru',            // адрес отправителя (домен должен совпадать с сайтом / SPF)
    'from_name'   => 'DIGITALI × Hybrid — Точки роста',
    'event_title' => 'Точки роста: Digital Meetup',
    'event_date'  => '26 ноября 2026, 15:00–20:00',
    'event_place' => 'г. Москва',                       // TODO: указать точный адрес площадки
    'site_url'    => 'https://digitali.ru/',
    'csv_dir'     => __DIR__ . '/registrations',
];
// ===============================================

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Method not allowed', 405);
}

// honeypot
if (!empty($_POST['website'])) {
    respond(true); // делаем вид, что всё ок
}

function field($key, $max = 120) {
    $v = isset($_POST[$key]) ? trim((string)$_POST[$key]) : '';
    $v = preg_replace('/[\r\n\t]+/', ' ', $v);
    return mb_substr($v, 0, $max, 'UTF-8');
}

$data = [
    'first_name' => field('first_name', 60),
    'last_name'  => field('last_name', 60),
    'email'      => field('email', 120),
    'phone'      => field('phone', 30),
    'company'    => field('company'),
    'position'   => field('position'),
    'sphere'     => field('sphere', 40),
    'agree'      => field('agree', 2),
];

$allowedSpheres = ['', 'E-commerce', 'Услуги', 'B2B', 'Производство', 'Другое'];
$phoneDigits = preg_replace('/\D/', '', $data['phone']);

if ($data['first_name'] === '' || $data['last_name'] === '') respond(false, 'Укажите имя и фамилию', 422);
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL))      respond(false, 'Проверьте формат email', 422);
if (!preg_match('/^7\d{10}$/', $phoneDigits))               respond(false, 'Проверьте номер телефона', 422);
if (!in_array($data['sphere'], $allowedSpheres, true))       $data['sphere'] = 'Другое';
if ($data['agree'] !== '1')                                  respond(false, 'Необходимо согласие на обработку данных', 422);

$h = function ($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
$now = date('d.m.Y H:i');

// ---------- CSV backup ----------
if (!is_dir($CONFIG['csv_dir'])) {
    @mkdir($CONFIG['csv_dir'], 0750, true);
    @file_put_contents($CONFIG['csv_dir'] . '/.htaccess', "Require all denied\nDeny from all\n");
}
$csv = $CONFIG['csv_dir'] . '/registrations.csv';
$isNew = !file_exists($csv);
if ($fp = @fopen($csv, 'a')) {
    if (flock($fp, LOCK_EX)) {
        if ($isNew) {
            fwrite($fp, "\xEF\xBB\xBF");
            fputcsv($fp, ['Дата', 'Имя', 'Фамилия', 'Email', 'Телефон', 'Компания', 'Должность', 'Сфера', 'IP'], ';');
        }
        fputcsv($fp, [$now, $data['first_name'], $data['last_name'], $data['email'], $data['phone'],
                      $data['company'], $data['position'], $data['sphere'], $_SERVER['REMOTE_ADDR'] ?? ''], ';');
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

// ---------- mail helper ----------
function send_mail($to, $subject, $html, $cfg, $replyTo = null) {
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= 'From: =?UTF-8?B?' . base64_encode($cfg['from_name']) . '?= <' . $cfg['from_email'] . ">\r\n";
    if ($replyTo) $headers .= "Reply-To: {$replyTo}\r\n";
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    return @mail($to, $subj, $html, $headers, '-f' . $cfg['from_email']);
}

function layout($title, $body) {
    return '<!doctype html><html lang="ru"><body style="margin:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#0B0F19">'
         . '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 12px"><tr><td align="center">'
         . '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">'
         . '<tr><td style="background:#0B0F19;padding:28px 32px;color:#ffffff">'
         . '<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#419BFF;font-weight:bold">DIGITALI × Hybrid</div>'
         . '<div style="font-size:24px;font-weight:bold;margin-top:8px">' . $title . '</div></td></tr>'
         . '<tr><td style="padding:32px;font-size:16px;line-height:1.6">' . $body . '</td></tr>'
         . '<tr><td style="padding:20px 32px;background:#F4F7FB;font-size:13px;color:#5B6476">'
         . 'welcome@digitali.ru · +7 (499) 110-60-17 · <a href="https://digitali.ru/" style="color:#1F7FEF">digitali.ru</a></td></tr>'
         . '</table></td></tr></table></body></html>';
}

// ---------- письмо участнику ----------
$userBody = '<p style="margin:0 0 16px">Здравствуйте, ' . $h($data['first_name']) . '!</p>'
    . '<p style="margin:0 0 20px">Спасибо за регистрацию на митап <b>«' . $h($CONFIG['event_title']) . '»</b>. Ваше место забронировано — будем рады видеть вас.</p>'
    . '<table cellpadding="0" cellspacing="0" style="width:100%;background:#EEF5FF;border-radius:14px;margin:0 0 20px"><tr><td style="padding:18px 20px">'
    . '<div style="margin-bottom:6px"><b>Дата и время:</b> ' . $h($CONFIG['event_date']) . '</div>'
    . '<div style="margin-bottom:6px"><b>Место:</b> ' . $h($CONFIG['event_place']) . '</div>'
    . '<div><b>Формат:</b> очный digital-митап с нетворкингом</div>'
    . '</td></tr></table>'
    . '<p style="margin:0 0 8px"><b>В программе:</b></p>'
    . '<ul style="margin:0 0 20px;padding-left:20px">'
    . '<li>Кейс «Нияма»: Магия брендформанса</li>'
    . '<li>Performance без границ: решения Digitali для Hobby Games</li>'
    . '<li>Взгляд изнутри: стратегическое выступление Hybrid</li>'
    . '<li>Кейс «Лесоруб»: Лиды в сезонной нише</li>'
    . '<li>УТП и точки роста в e-commerce</li>'
    . '<li>Afterparty &amp; Networking</li></ul>'
    . '<p style="margin:0 0 20px">Сбор гостей с 15:00. Накануне мероприятия мы пришлём напоминание.</p>'
    . '<p style="margin:0">До встречи!<br>Команды DIGITALI и Hybrid</p>';

$userSent = send_mail($data['email'], 'Вы зарегистрированы: ' . $CONFIG['event_title'], layout('Спасибо за регистрацию!', $userBody), $CONFIG);

// ---------- уведомление организаторам ----------
$rows = [
    'Имя' => $data['first_name'], 'Фамилия' => $data['last_name'], 'Email' => $data['email'],
    'Телефон' => $data['phone'], 'Компания' => $data['company'] ?: '—', 'Должность' => $data['position'] ?: '—',
    'Сфера бизнеса' => $data['sphere'] ?: '—', 'Дата заявки' => $now,
];
$table = '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">';
foreach ($rows as $k => $v) {
    $table .= '<tr><td style="padding:10px 0;border-bottom:1px solid #E3E8F0;color:#5B6476;width:40%">' . $h($k)
            . '</td><td style="padding:10px 0;border-bottom:1px solid #E3E8F0;font-weight:bold">' . $h($v) . '</td></tr>';
}
$table .= '</table>';

$adminOk = true;
foreach ($CONFIG['organizers'] as $to) {
    $adminOk = send_mail($to, 'Новая регистрация: ' . $data['first_name'] . ' ' . $data['last_name'],
        layout('Новая регистрация на митап', $table), $CONFIG, $data['email']) && $adminOk;
}

// Заявка сохранена в CSV в любом случае; ошибку отдаём только если не ушло вообще ничего
if (!$userSent && !$adminOk && !file_exists($csv)) {
    respond(false, 'Не удалось отправить заявку. Напишите нам на welcome@digitali.ru', 500);
}

respond(true);
