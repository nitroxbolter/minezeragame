-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 14/09/2026 às 15:50
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `minezera`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `classes`
--

CREATE TABLE `classes` (
  `id` tinyint(3) UNSIGNED NOT NULL,
  `nome` varchar(40) NOT NULL,
  `descricao` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `classes`
--

INSERT INTO `classes` (`id`, `nome`, `descricao`) VALUES
(0, 'Guerreiro', 'Mais vida e forca para combate corpo a corpo.'),
(1, 'Lenhador', 'Comeca com afinidade em coleta de madeira.'),
(2, 'Minerador', 'Comeca com afinidade em mineracao.'),
(3, 'Fazendeiro', 'Comeca com afinidade em plantio e comida.'),
(4, 'Artesao', 'Comeca com afinidade em crafting.');

-- --------------------------------------------------------

--
-- Estrutura para tabela `contas`
--

CREATE TABLE `contas` (
  `id` int(10) UNSIGNED NOT NULL,
  `login` varchar(40) NOT NULL,
  `senha_hash` varchar(255) NOT NULL,
  `tipo` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `ultimo_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Nenhuma conta inicial e incluida neste dump publico.
-- Crie uma conta pela aplicacao e promova-a a admin quando necessario.
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `personagens`
--

CREATE TABLE `personagens` (
  `id` int(10) UNSIGNED NOT NULL,
  `conta_id` int(10) UNSIGNED NOT NULL,
  `nome` varchar(40) NOT NULL,
  `classe_id` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `nivel` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `exp` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `hp` int(10) UNSIGNED NOT NULL DEFAULT 100,
  `hunger` int(10) UNSIGNED NOT NULL DEFAULT 20,
  `pos_x` double DEFAULT 16.32,
  `pos_y` double DEFAULT 71,
  `pos_z` double DEFAULT 31.11,
  `yaw` double NOT NULL DEFAULT 0,
  `pitch` double NOT NULL DEFAULT 0,
  `inventory_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`inventory_json`)),
  `hotbar` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `skill_lenhador` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `skill_cooking` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `skill_mining` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `skill_crafting` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `skill_farming` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `forca` int(10) UNSIGNED NOT NULL DEFAULT 10,
  `kills` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `dias_jogados` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `atualizado_em` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Nenhum personagem inicial e incluido neste dump publico.
--

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `classes`
--
ALTER TABLE `classes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nome` (`nome`);

--
-- Índices de tabela `contas`
--
ALTER TABLE `contas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `login` (`login`);

--
-- Índices de tabela `personagens`
--
ALTER TABLE `personagens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `conta_id` (`conta_id`),
  ADD UNIQUE KEY `nome` (`nome`),
  ADD KEY `fk_personagens_classe` (`classe_id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `contas`
--
ALTER TABLE `contas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT de tabela `personagens`
--
ALTER TABLE `personagens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `personagens`
--
ALTER TABLE `personagens`
  ADD CONSTRAINT `fk_personagens_classe` FOREIGN KEY (`classe_id`) REFERENCES `classes` (`id`),
  ADD CONSTRAINT `fk_personagens_conta` FOREIGN KEY (`conta_id`) REFERENCES `contas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
