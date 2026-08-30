const adminDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Amsterdam',
})

export const formatAdminDateTime = (timestamp: number) =>
  adminDateTimeFormatter.format(timestamp)
