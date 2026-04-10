import { Request, Response } from "express";
import * as superadminService from "./superadmin.service.js";

export async function getStats(_req: Request, res: Response) {
  const stats = await superadminService.getPlatformStats();
  res.json(stats);
}

export async function listRestaurants(_req: Request, res: Response) {
  const restaurants = await superadminService.listRestaurants();
  res.json(restaurants);
}

export async function getRestaurant(req: Request, res: Response) {
  const restaurant = await superadminService.getRestaurant(req.params.id as string);
  res.json(restaurant);
}

export async function createRestaurant(req: Request, res: Response) {
  const result = await superadminService.createRestaurant(req.body);
  res.status(201).json(result);
}

export async function updateRestaurant(req: Request, res: Response) {
  const restaurant = await superadminService.updateRestaurant(req.params.id as string, req.body);
  res.json(restaurant);
}

export async function listRestaurantUsers(req: Request, res: Response) {
  const users = await superadminService.listRestaurantUsers(req.params.id as string);
  res.json(users);
}

export async function listPendingUsers(_req: Request, res: Response) {
  const users = await superadminService.listPendingUsers();
  res.json(users);
}

export async function assignRole(req: Request, res: Response) {
  const user = await superadminService.assignRole(req.params.id as string, req.body);
  res.json(user);
}
