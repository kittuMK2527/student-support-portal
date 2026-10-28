import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TicketStatus } from '@/types';
import { api, type AdminListQuery } from './index';
import type { CreateTicketInput, RegisterInput } from './backend';
import { useSession } from '@/lib/store/session';

export const qk = {
  reference: ['reference'] as const,
  myTickets: (status?: string) => ['student', 'tickets', status ?? 'all'] as const,
  myTicket: (id: string) => ['student', 'ticket', id] as const,
  adminSummary: (collegeId?: string) => ['admin', 'summary', collegeId ?? 'all'] as const,
  adminList: (q: AdminListQuery) => ['admin', 'list', q] as const,
  adminTicket: (id: string) => ['admin', 'ticket', id] as const,
  outbox: (ticketId?: string) => ['admin', 'outbox', ticketId ?? 'all'] as const,
};

export const useReference = () =>
  useQuery({ queryKey: qk.reference, queryFn: api.reference, staleTime: Infinity });
function useSessionMutation<A>(fn: (a: A) => Promise<import('@/types').PublicUser>) {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: fn,
    onSuccess: (u) => {
      qc.clear();
      setUser(u);
    },
  });
}
export const useLogin = () =>
  useSessionMutation((a: { email: string; password: string }) =>
    api.auth.login(a.email, a.password),
  );
export const useDemoLogin = () =>
  useSessionMutation((role: 'student' | 'admin') => api.auth.demoLogin(role));
export const useRegister = () =>
  useSessionMutation((input: RegisterInput) => api.auth.register(input));
export function useLogout() {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      qc.clear();
      setUser(null);
    },
  });
}
export const useMyTickets = (status?: TicketStatus) =>
  useQuery({ queryKey: qk.myTickets(status), queryFn: () => api.student.list(status) });
export const useMyTicket = (id: string) =>
  useQuery({ queryKey: qk.myTicket(id), queryFn: () => api.student.get(id) });
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CreateTicketInput) => api.student.create(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student'] }),
  });
}
export function useStudentAction<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student'] }),
  });
}
export const useStudentHome = () =>
  useQuery({ queryKey: ['student', 'home'], queryFn: api.student.home });
export const useSubjects = () =>
  useQuery({ queryKey: ['student', 'subjects'], queryFn: api.student.subjects });
export const useResults = () =>
  useQuery({ queryKey: ['student', 'results'], queryFn: api.student.results });
export const useAttendance = () =>
  useQuery({ queryKey: ['student', 'attendance'], queryFn: api.student.attendance });
export const useTimetable = () =>
  useQuery({ queryKey: ['student', 'timetable'], queryFn: api.student.timetable });
export const useNotices = () =>
  useQuery({ queryKey: ['student', 'notices'], queryFn: api.student.notices });
export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return useMutation({
    mutationFn: api.student.updateProfile,
    onSuccess: (u) => {
      setUser(u);
      qc.invalidateQueries({ queryKey: ['student'] });
    },
  });
}
export const useAdminStudents = (q: { q?: string; collegeId?: string }) =>
  useQuery({
    queryKey: ['admin', 'students', q],
    queryFn: () => api.admin.students(q),
    placeholderData: (p) => p,
  });
export const useAdminNotices = () =>
  useQuery({ queryKey: ['admin', 'notices'], queryFn: api.admin.notices });
export const useAdminSummary = (collegeId?: string) =>
  useQuery({ queryKey: qk.adminSummary(collegeId), queryFn: () => api.admin.summary(collegeId) });
export const useAdminList = (q: AdminListQuery) =>
  useQuery({
    queryKey: qk.adminList(q),
    queryFn: () => api.admin.list(q),
    placeholderData: (prev) => prev,
  });
export const useAdminTicket = (id: string) =>
  useQuery({ queryKey: qk.adminTicket(id), queryFn: () => api.admin.get(id) });
export const useOutbox = (ticketId?: string) =>
  useQuery({ queryKey: qk.outbox(ticketId), queryFn: () => api.admin.outbox(ticketId) });
export function useAdminAction<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}
