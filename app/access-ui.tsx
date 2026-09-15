"use client";
import {createContext,useContext} from 'react';
import {hasPermission} from '@/lib/permissions';
export const AccessContext=createContext<any>(null);
export function useAccess(){const user=useContext(AccessContext);return (permission:string)=>hasPermission(user,permission)}
export function AccessButton({permission,...props}:any){const can=useAccess();return can(permission)?<button {...props}/>:null}
