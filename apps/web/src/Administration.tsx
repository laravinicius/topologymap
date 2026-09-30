import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { AccessibleCompany, ManagedUser, CompanyPermissionView, CompanyRole } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';

export function Administration({ companies, refreshCompanies, checkSession }: { companies: AccessibleCompany[]; refreshCompanies: () => Promise<void>; checkSession: () => Promise<void> }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userId, setUserId] = useState('');
  const [name, setName] = useState(''), [login, setLogin] = useState(''), [password, setPassword] = useState('');
  const [isActive, setActive] = useState(true);
  const [companyId, setCompanyId] = useState(''), [companyName, setCompanyName] = useState('');
  const [deleteCompany, setDeleteCompany] = useState(false);
  const [permissionUser, setPermissionUser] = useState(''), [permissionCompany, setPermissionCompany] = useState('');
  const [role, setRole] = useState<CompanyRole>('viewer');
  const [permissions, setPermissions] = useState<CompanyPermissionView[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const permissionRequest = useRef(0);
  async function loadUsers() {
    const result = await api<{ users: ManagedUser[] }>('/admin/users'); setUsers(result.users);
  }
  useEffect(() => {
    let active = true;
    void api<{ users: ManagedUser[] }>('/admin/users').then(result => { if (active) setUsers(result.users); }).catch(e => {
      if (active) { setError(message(e)); if (e instanceof ApiError && [401, 403].includes(e.status)) void checkSession(); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [checkSession]);
  useEffect(() => {
    const number = ++permissionRequest.current;
    setPermissions([]);
    if (!permissionUser) { setLoadingPermissions(false); return; }
    setLoadingPermissions(true);
    void api<{ permissions: CompanyPermissionView[] }>(`/admin/users/${permissionUser}/permissions`).then(result => {
      if (number === permissionRequest.current) setPermissions(result.permissions);
    }).catch(e => { if (number === permissionRequest.current) setError(message(e)); }).finally(() => {
      if (number === permissionRequest.current) setLoadingPermissions(false);
    });
    return () => { permissionRequest.current++; };
  }, [permissionUser]);
  function selectUser(id: string) {
    setUserId(id); const user = users.find(u => u.id === id);
    setName(user?.name ?? ''); setLogin(user?.login ?? ''); setActive(user?.isActive ?? true); setPassword(''); setNotice(''); setError('');
  }
  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); }
    catch (e) { setError(message(e)); if (e instanceof ApiError && [401, 403].includes(e.status)) void checkSession(); }
    finally { setBusy(false); }
  }
  function saveUser(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      const saved = await api<ManagedUser>(userId ? `/admin/users/${userId}` : '/admin/users', json(userId ? 'PATCH' : 'POST', {
        name, login, ...(userId ? { isActive } : {}), ...(password ? { password } : {}),
      }));
      setPassword(''); setUserId(saved.id); setName(saved.name); setLogin(saved.login); setActive(saved.isActive);
      if (!userId) { setPermissionUser(saved.id); setPermissionCompany(''); setRole('viewer'); }
      await loadUsers(); await checkSession();
    }, userId ? 'Usuário atualizado.' : 'Usuário criado. Conceda seu acesso por empresa abaixo.');
  }
  function saveCompany(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      await api(companyId ? `/admin/companies/${companyId}` : '/admin/companies', json(companyId ? 'PATCH' : 'POST', { name: companyName }));
      setCompanyId(''); setCompanyName(''); setDeleteCompany(false); await refreshCompanies();
    }, 'Empresa salva.');
  }
  function grant(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      await api(`/admin/users/${permissionUser}/permissions/${permissionCompany}`, json('PUT', { role }));
      setPermissions((await api<{ permissions: CompanyPermissionView[] }>(`/admin/users/${permissionUser}/permissions`)).permissions);
    }, 'Permissão salva. Válida a partir da próxima requisição.');
  }
  const selectedUser = users.find(u => u.id === userId);
  const selectedPermissionUser = users.find(u => u.id === permissionUser);
  const disabled = busy || loading;
  return <section className="panel" aria-labelledby="admin-title" aria-busy={disabled}>
    <h2 id="admin-title">Administração geral</h2>
    <p className="intro">Usuários, empresas e acessos. Somente o administrador geral pode alterar estes cadastros.</p>
    {loading && <p role="status">Carregando usuários…</p>}
    {error && <p role="alert" id="admin-error" className="error">{error}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    <div className="admin-grid">
      <section aria-labelledby="companies-title">
        <h3 id="companies-title">Empresas</h3>
        <form onSubmit={saveCompany} aria-describedby={error ? 'admin-error' : undefined}>
          <label htmlFor="edit-company">Empresa para editar</label>
          <select id="edit-company" disabled={disabled} value={companyId} onChange={e => { setCompanyId(e.target.value); setDeleteCompany(false); setCompanyName(companies.find(c => c.id === e.target.value)?.name ?? ''); }}>
            <option value="">Nova empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label htmlFor="company-name">Nome da empresa</label>
          <input id="company-name" required maxLength={200} value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={disabled} />
          <button disabled={disabled} type="submit">{companyId ? 'Salvar empresa' : 'Criar empresa'}</button>
          {companyId && <button type="button" className="secondary" disabled={disabled} onClick={() => setDeleteCompany(true)}>Excluir empresa</button>}
        </form>
        {companyId && deleteCompany && <div className="delete-confirm" role="group" aria-label="Confirmar exclusão da empresa">
          <p>Excluir <strong>{companies.find(c => c.id === companyId)?.name}</strong> definitivamente? Remova seus cadastros e revogue seus acessos antes. A exclusão não remove dependências automaticamente.</p>
          <button disabled={disabled} onClick={() => void perform(async () => {
            await api(`/admin/companies/${companyId}`, { method: 'DELETE' });
            setCompanyId(''); setCompanyName(''); setDeleteCompany(false); setPermissionCompany('');
            setPermissions(current => current.filter(p => p.companyId !== companyId)); await refreshCompanies();
          }, 'Empresa excluída.')}>Confirmar exclusão da empresa</button>
          <button className="secondary" disabled={disabled} onClick={() => setDeleteCompany(false)}>Cancelar exclusão da empresa</button>
        </div>}
        {!companies.length && <p>Nenhuma empresa cadastrada.</p>}
      </section>
      <section aria-labelledby="users-title">
        <h3 id="users-title">Usuários</h3>
        <form onSubmit={saveUser} aria-describedby={error ? 'admin-error' : undefined}>
          <label htmlFor="edit-user">Usuário para editar</label>
          <select id="edit-user" disabled={disabled} value={userId} onChange={e => selectUser(e.target.value)}>
            <option value="">Novo usuário</option>{users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.login}){!u.isActive ? ' — Inativo' : u.isAdmin ? ' — Administrador' : ''}</option>)}
          </select>
          <label htmlFor="user-name">Nome do usuário</label>
          <input id="user-name" required maxLength={200} autoComplete="off" value={name} onChange={e => setName(e.target.value)} disabled={disabled} />
          <label htmlFor="user-login">Login do usuário</label>
          <input id="user-login" required maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} value={login} onChange={e => setLogin(e.target.value)} disabled={disabled} />
          <label htmlFor="user-password">{userId ? 'Nova senha (opcional)' : 'Senha inicial'}</label>
          <input id="user-password" type="password" autoComplete="new-password" required={!userId} minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={disabled} aria-describedby="password-hint" />
          <p className="intro hint" id="password-hint">12 a 128 caracteres. Trocar a senha encerra as sessões existentes.</p>
          {userId && <label className="checkbox"><input type="checkbox" checked={isActive} onChange={e => setActive(e.target.checked)} disabled={disabled || selectedUser?.isAdmin} />Usuário ativo</label>}
          {selectedUser?.isAdmin && <p className="intro">O administrador geral tem acesso a todas as empresas e não pode ser desativado.</p>}
          <button disabled={disabled} type="submit">{userId ? 'Salvar usuário' : 'Criar usuário'}</button>
          {userId && <button disabled={disabled} className="secondary" type="button" onClick={() => selectUser('')}>Novo usuário</button>}
        </form>
      </section>
    </div>
    <section className="permissions" aria-labelledby="permissions-title">
      <h3 id="permissions-title">Permissões por empresa</h3>
      <form onSubmit={grant} aria-describedby={error ? 'admin-error' : undefined}>
        <label htmlFor="permission-user">Usuário que receberá acesso</label>
        <select id="permission-user" required value={permissionUser} onChange={e => { setPermissionUser(e.target.value); setPermissionCompany(''); setRole('viewer'); }} disabled={disabled}>
          <option value="">Selecione um usuário</option>{users.filter(u => !u.isAdmin).map(u => <option key={u.id} value={u.id}>{u.name}{!u.isActive ? ' — Inativo' : ''}</option>)}
        </select>
        <label htmlFor="permission-company">Empresa da permissão</label>
        <select id="permission-company" required value={permissionCompany} onChange={e => setPermissionCompany(e.target.value)} disabled={disabled}>
          <option value="">Selecione uma empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label htmlFor="permission-role">Nível de acesso</label>
        <select id="permission-role" value={role} onChange={e => setRole(e.target.value as CompanyRole)} disabled={disabled}>
          <option value="viewer">Visualização</option><option value="manager">Gerenciamento</option>
        </select>
        <button disabled={disabled || loadingPermissions || !selectedPermissionUser?.isActive} type="submit">Salvar permissão</button>
      </form>
      {loadingPermissions && <p role="status">Carregando permissões…</p>}
      {permissionUser && !loadingPermissions && (permissions.length ? <ul className="permission-list">{permissions.map(p => <li key={p.companyId}>
        <span><strong>{companies.find(c => c.id === p.companyId)?.name ?? 'Empresa indisponível'}</strong><br />{p.role === 'manager' ? 'Gerenciamento' : 'Visualização'}</span>
        <button className="secondary" disabled={disabled} aria-label={`Revogar acesso a ${companies.find(c => c.id === p.companyId)?.name ?? 'empresa'}`} onClick={() => void perform(async () => {
          await api(`/admin/users/${permissionUser}/permissions/${p.companyId}`, { method: 'DELETE' });
          setPermissions(current => current.filter(item => item.companyId !== p.companyId));
        }, 'Acesso revogado. Válido a partir da próxima requisição.')}>Revogar acesso</button>
      </li>)}</ul> : <p>Nenhum acesso concedido a este usuário.</p>)}
      {selectedPermissionUser && !selectedPermissionUser.isActive && <p className="intro">Usuário inativo: não pode entrar nem receber novos acessos. Você pode revogar os acessos existentes.</p>}
    </section>
  </section>;
}
