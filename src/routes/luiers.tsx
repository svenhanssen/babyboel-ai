import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/luiers')({
  component: Outlet,
})
