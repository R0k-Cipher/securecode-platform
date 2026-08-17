import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

// Adapte ces imports selon ton module Auth
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Récupérer le profil de l’utilisateur connecté',
  })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Modifier le profil de l’utilisateur connecté',
  })
  updateCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateCurrentUser(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les utilisateurs avec pagination et filtres',
  })
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un utilisateur par son identifiant',
  })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Modifier le statut d’un utilisateur',
  })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier un utilisateur',
  })
  updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
  })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Utilisateur supprimé avec succès',
      },
    },
  })
  deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.deleteUser(id, currentUser.id);
  }
}
