import type { AuthUser } from './auth.js';
import type { Company, CompanyRole } from './entities.js';

/** Contratos públicos: nenhum hash, token ou registro interno de sessão. */
export interface ManagedUser extends AuthUser { isActive: boolean; createdAt: string; updatedAt: string }
export interface CreateUserInput { name: string; login: string; password: string }
export interface UpdateUserInput { name?: string; login?: string; password?: string; isActive?: boolean }
export interface AccessibleCompany extends Company { role: CompanyRole | 'admin' }
export interface CompanyPermissionView { companyId: string; role: CompanyRole }
export interface CompanyInput { name: string }
export interface PermissionInput { role: CompanyRole }
