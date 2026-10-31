// Requires an already signed-in local demo page. Only navigates; never changes records.
async page => {
  const errors = [];
  const handler = error => errors.push(error.message);
  page.on('pageerror', handler);
  try {
    await page.goto('http://localhost:8081/parent');
    for (let i = 0; i < 4; i++) {
      await page.getByRole('link', { name: 'Takvimi aç' }).click();
      await page.getByText('Yeni etkinlik veya ders', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Geri', exact: true }).click();
      await page.getByRole('link', { name: 'Takvimi aç' }).waitFor();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    return { calendarRoundTrips: 4, errors };
  } finally { page.off('pageerror', handler); }
}
