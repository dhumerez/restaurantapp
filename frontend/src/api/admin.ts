import client from "./client";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "waiter" | "kitchen";
  isActive: boolean;
  createdAt: string;
}

export async function getStaff(): Promise<StaffMember[]> {
  const { data } = await client.get<StaffMember[]>("/admin/staff");
  return data;
}

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "waiter" | "kitchen";
}): Promise<StaffMember> {
  const { data } = await client.post<StaffMember>("/admin/staff", input);
  return data;
}

export async function updateStaff(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    password: string;
    role: "admin" | "waiter" | "kitchen";
    isActive: boolean;
  }>
): Promise<StaffMember> {
  const { data } = await client.put<StaffMember>(`/admin/staff/${id}`, input);
  return data;
}

export async function deleteStaff(id: string): Promise<void> {
  await client.delete(`/admin/staff/${id}`);
}
