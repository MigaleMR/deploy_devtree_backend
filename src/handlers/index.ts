import type { Request, Response } from "express";
import { validationResult } from "express-validator";
import slug from "slug";
import formidable from "formidable";
import { v4 as uuid } from "uuid";
import User from "../models/User";
import { checkPassword, hashPassword } from "../util/auth";
import { generateJWT } from "../util/jwt";
import cloudinary from "../config/cloudinary";

export const createAccount = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const userExists = await User.findOne({ email });
  if (userExists) {
    const error = new Error("El Usuario con ese email ya está registrado");
    res.status(409).json({ error: error.message });
    return;
  }

  const handle = slug(req.body.handle, "");
  const handleExists = await User.findOne({ handle });
  if (handleExists) {
    const error = new Error("Nombre de Usuario no disponible");
    res.status(409).json({ error: error.message });
    return;
  }

  const user = new User(req.body);
  user.password = await hashPassword(password);
  user.handle = handle;

  await user.save();
  res.status(201).send("Registro creado correctamente");
};

export const login = async (req: Request, res: Response) => {
  // Manejar Errores
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  // Revisar si el user está registrado
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("El usuario no existe");
    res.status(404).json({ error: error.message });
    return;
  }

  // Comprobar el password
  const isPasswordCorrect = await checkPassword(password, user.password);
  if (!isPasswordCorrect) {
    const error = new Error("Password incorrecto");
    res.status(401).json({ error: error.message });
    return;
  }

  const token = generateJWT({ id: user._id });

  res.send(token);
};

export const getUser = async (req: Request, res: Response) => {
  res.json(req.user);
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { description, links } = req.body;

    const handle = slug(req.body.handle, "");
    const handleExists = await User.findOne({ handle });
    if (handleExists && handleExists.email !== req.user.email) {
      const error = new Error("Nombre de Usuario no disponible");
      res.status(409).json({ error: error.message });
      return;
    }

    // Actualizar user
    req.user.description = description;
    req.user.handle = handle;
    req.user.links = links;
    await req.user.save();
    res.send("Perfil Actualizado Correctamente");
  } catch (e) {
    const error = new Error("Hubo un error");
    res.status(500).json({ error: error.message });
    return;
  }
};

export const uploadImage = async (req: Request, res: Response) => {
  const form = formidable({ multiples: false });

  try {
    form.parse(req, (error, fields, files) => {
      cloudinary.uploader.upload(
        files.file[0].filepath,
        { public_id: uuid() },
        async function (error, result) {
          if (error) {
            const error = new Error("Hubo un error al subir la imagen");
            res.status(500).json({ error: error.message });
            return;
          }
          if (result) {
            req.user.image = result.secure_url;
            await req.user.save();
            res.json({ image: result.secure_url });
          }
        }
      );
    });
  } catch (e) {
    const error = new Error("Hubo un error");
    res.status(500).json({ error: error.message });
    return;
  }
};
export const getUserByHandle = async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const user = await User.findOne({ handle }).select(
      "-_id -password -__v -email"
    );
    if (!user) {
      const error = new Error("El Usuario no Existe");
      res.status(404).json({ error: error.message });
      return;
    }
    res.json(user);
  } catch (e) {
    const error = new Error("Hubo un error");
    res.status(500).json({ error: error.message });
    return;
  }
};

export const searchByHandle = async (req: Request, res: Response) => {
  try {
    const { handle } = req.body;
    const userExists = await User.findOne({ handle });
    if (userExists) {
      const error = new Error(`${handle} ya está registrado`);
      res.status(409).json({ error: error.message });
    }
    res.send(`${handle} está disponible`);
  } catch (e) {
    const error = new Error("Hubo un error");
    res.status(500).json({ error: error.message });
    return;
  }
};
